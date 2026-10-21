<#
.SYNOPSIS
  Deletes everything deploy.ps1 created, so nothing keeps billing after the demo.

.EXAMPLE
  ./deploy/aws/destroy.ps1                 # keeps the secrets in Parameter Store (free) for a later redeploy
  ./deploy/aws/destroy.ps1 -DeleteSecrets
#>
param(
    [string]$StackName = 'dcm',
    [string]$Region = 'us-east-1',
    [switch]$DeleteSecrets
)
$ErrorActionPreference = 'Stop'
$aws = (Get-Command aws -ErrorAction SilentlyContinue).Source
if (-not $aws) { $aws = 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' }

$bucket = & { $ErrorActionPreference = 'Continue'
    & $aws --region $Region cloudformation describe-stacks --stack-name $StackName `
        --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text 2>$null }
if ($LASTEXITCODE -eq 0 -and $bucket) {
    Write-Host "== Emptying s3://$bucket (a bucket must be empty before it can be deleted)"
    & $aws --region $Region s3 rm "s3://$bucket" --recursive --only-show-errors
}

Write-Host "== Deleting stack '$StackName' (CloudFront takes the longest, ~10 minutes)"
& $aws --region $Region cloudformation delete-stack --stack-name $StackName
& $aws --region $Region cloudformation wait stack-delete-complete --stack-name $StackName
if ($LASTEXITCODE -ne 0) { throw 'Stack deletion did not finish - check the CloudFormation console' }

if ($DeleteSecrets) {
    $names = & $aws --region $Region ssm get-parameters-by-path --path "/$StackName" --query 'Parameters[].Name' --output text
    if ($names) { & $aws --region $Region ssm delete-parameters --names ($names -split '\s+') | Out-Null }
    Write-Host "  deleted Parameter Store secrets under /$StackName"
}
Write-Host "Done - all DCM resources are deleted."
