<#
.SYNOPSIS
  Deploys the DCM platform to AWS: secrets, CloudFormation stack, backend release and React build.

.DESCRIPTION
  Safe to re-run. The first run creates everything (about 15-20 minutes, mostly RDS and CloudFront);
  later runs only ship new code. The backend is packaged with `git archive`, so only committed files
  are uploaded - never .env, the SQLite database or local recordings.

.EXAMPLE
  ./deploy/aws/deploy.ps1 -AlertEmail you@example.com
.EXAMPLE
  ./deploy/aws/deploy.ps1 -LearnerLab        # AWS Academy Learner Lab (uses LabInstanceProfile, no Budgets)
#>
param(
    [string]$StackName = 'dcm',
    [string]$Region = 'us-east-1',
    [string]$AlertEmail = '',
    [string]$AdminEmail = 'admin@dcm-demo.com',
    [ValidateSet('t2.micro', 't3.micro', 't3.small')]
    [string]$InstanceType = 't3.micro',
    [switch]$LearnerLab
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/../..").Path
$prefix = "/$StackName"
$aws = (Get-Command aws -ErrorAction SilentlyContinue).Source
if (-not $aws) { $aws = 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' }

function Aws {
    # The CLI prints progress on stderr; success is judged by the exit code alone
    $ErrorActionPreference = 'Continue'
    $out = & $aws --region $Region @args
    if ($LASTEXITCODE -ne 0) { throw "aws $($args[0]) $($args[1]) failed (exit $LASTEXITCODE)" }
    $out
}
function Test-Aws {
    # Windows PowerShell turns redirected stderr into terminating errors under 'Stop'
    $ErrorActionPreference = 'Continue'
    & $aws --region $Region @args 2>$null | Out-Null
    $LASTEXITCODE -eq 0
}
function New-Secret([int]$Length) {
    $chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    $bytes = New-Object byte[] $Length
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}
function Set-ParamIfMissing([string]$Name, [scriptblock]$Value, [string]$Type = 'SecureString') {
    if (Test-Aws ssm get-parameter --name "$prefix/$Name") { return }
    Aws ssm put-parameter --name "$prefix/$Name" --type $Type --value (& $Value) | Out-Null
    Write-Host "  created $prefix/$Name"
}

Write-Host "== Checking AWS login"
Aws sts get-caller-identity --query Arn --output text

Write-Host "== Secrets in Parameter Store ($prefix/*)"
Set-ParamIfMissing 'groq-api-key' {
    $line = Get-Content "$root/backend/.env" | Where-Object { $_ -match '^\s*GROQ_API_KEY\s*=' } | Select-Object -First 1
    if (-not $line) { throw 'GROQ_API_KEY not found in backend/.env' }
    ($line -split '=', 2)[1].Trim().Trim('"')
}
Set-ParamIfMissing 'jwt-secret' { New-Secret 48 }
Set-ParamIfMissing 'db-password' { New-Secret 24 }
Set-ParamIfMissing 'admin-password' { New-Secret 16 }
Set-ParamIfMissing 'admin-email' { $AdminEmail } 'String'

Write-Host "== Building the frontend"
Push-Location $root
try {
    & { $ErrorActionPreference = 'Continue'; npm run build 2>&1 | Select-Object -Last 3 }
    if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
    if (git status --porcelain -- backend) { Write-Warning 'backend/ has uncommitted changes; only committed code is deployed' }
    $zip = Join-Path $env:TEMP "dcm-backend-$StackName.zip"
    git archive --format=zip -o $zip HEAD backend
    if ($LASTEXITCODE -ne 0) { throw 'git archive failed' }
} finally { Pop-Location }

Write-Host "== CloudFormation stack '$StackName'"
$stackExists = Test-Aws cloudformation describe-stacks --stack-name $StackName
$prefixList = Aws ec2 describe-managed-prefix-lists --filters 'Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing' --query 'PrefixLists[0].PrefixListId' --output text
$overrides = @(
    "InstanceType=$InstanceType", "CloudFrontPrefixList=$prefixList", "AlertEmail=$AlertEmail", "ParameterPrefix=$prefix",
    "ExistingInstanceProfile=$(if ($LearnerLab) { 'LabInstanceProfile' } else { '' })",
    "CreateBudget=$(if ($LearnerLab) { 'false' } else { 'true' })"
)
if (-not $stackExists) {
    # Pick the engine version only on create; later runs keep it so the database is never upgraded by surprise
    $versions = (Aws rds describe-db-engine-versions --engine postgres --query 'DBEngineVersions[].EngineVersion' --output text) -split '\s+' |
        Where-Object { $_ -match '^16\.\d+$' } | Sort-Object { [version]$_ }
    if (-not $versions) { throw 'No PostgreSQL 16.x version offered in this region' }
    $overrides += "DBEngineVersion=$($versions[-1])"
    Write-Host "  new stack, PostgreSQL $($versions[-1]) - this takes about 15-20 minutes"
}
Aws cloudformation deploy --template-file "$PSScriptRoot/template.yaml" --stack-name $StackName `
    --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset --parameter-overrides @overrides

$outputs = @{}
(Aws cloudformation describe-stacks --stack-name $StackName --query 'Stacks[0].Outputs' --output json | Out-String | ConvertFrom-Json) |
    ForEach-Object { $outputs[$_.OutputKey] = $_.OutputValue }
$bucket = $outputs.BucketName

Write-Host "== Uploading backend release and site to s3://$bucket"
Aws s3 cp $zip "s3://$bucket/releases/backend.zip" --only-show-errors
Aws s3 sync "$root/dist" "s3://$bucket/site" --delete --exclude index.html --only-show-errors
Aws s3 cp "$root/dist/index.html" "s3://$bucket/site/index.html" --cache-control no-cache --only-show-errors
Aws cloudfront create-invalidation --distribution-id $outputs.DistributionId --paths '/*' --query Invalidation.Id --output text | Out-Null

if ($stackExists) {
    Write-Host "== Restarting the backend with the new release (SSM Run Command)"
    $cmd = Aws ssm send-command --instance-ids $outputs.InstanceId --document-name AWS-RunShellScript `
        --parameters commands=/opt/dcm/deploy.sh --query Command.CommandId --output text
    & $aws --region $Region ssm wait command-executed --command-id $cmd --instance-id $outputs.InstanceId
    Aws ssm get-command-invocation --command-id $cmd --instance-id $outputs.InstanceId --query '[Status,StandardOutputContent]' --output text
}

Write-Host "== Waiting for $($outputs.SiteUrl)/_/backend/health"
$deadline = (Get-Date).AddMinutes(25)
do {
    try {
        $r = Invoke-WebRequest "$($outputs.SiteUrl)/_/backend/health" -UseBasicParsing -TimeoutSec 15
        if ($r.StatusCode -eq 200) { break }
    } catch { }
    Start-Sleep 20
} while ((Get-Date) -lt $deadline)
if ((Get-Date) -ge $deadline) { throw "Backend not healthy yet - check the '$($outputs.LogGroup)' log group (bootstrap stream)" }

Write-Host ""
Write-Host "Live at:   $($outputs.SiteUrl)"
Write-Host "Admin:     $(Aws ssm get-parameter --name "$prefix/admin-email" --query Parameter.Value --output text)"
Write-Host "Password:  aws ssm get-parameter --region $Region --with-decryption --name $prefix/admin-password --query Parameter.Value --output text"
