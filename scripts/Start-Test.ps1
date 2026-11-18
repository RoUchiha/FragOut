$ErrorActionPreference='Stop'
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$stateRoot=[IO.Path]::GetFullPath((Join-Path $repository '../../work/fragout-test'))
$tlsRoot=[IO.Path]::GetFullPath((Join-Path $repository '../../work/fragout-iphone/tls'))
$identity=Get-Content -LiteralPath (Join-Path $tlsRoot 'info.json') -Raw | ConvertFrom-Json
if(([DateTimeOffset]$identity.expires) -le [DateTimeOffset]::UtcNow){throw 'Renew the local iPhone HTTPS trust profile before starting the test app.'}
if(!(Test-Path -LiteralPath (Join-Path $repository '.next/BUILD_ID'))){throw 'Build FragOut before starting the private test app.'}
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
$privateKey=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $tlsRoot 'server.dpapi')),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
try{
 Set-Location -LiteralPath $repository
 [Convert]::ToBase64String($privateKey) | & node --experimental-strip-types (Join-Path $PSScriptRoot 'serve-private-test.mjs') $identity.address 3444 (Join-Path $tlsRoot 'server.pem') (Join-Path $stateRoot 'data/fragout.sqlite')
 exit $LASTEXITCODE
}finally{[Array]::Clear($privateKey)}
