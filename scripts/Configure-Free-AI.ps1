$ErrorActionPreference='Stop'
Set-Location -LiteralPath ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')))
Write-Host 'This stores the Groq key as a Sensitive Production-only server variable in FragOut on Vercel.'
if((Read-Host 'Type FREE to confirm a dedicated Groq Free account with no payment method') -cne 'FREE'){throw 'Free account confirmation required.'}
if((Read-Host 'Type ZDR to confirm Zero Data Retention is enabled in Groq Data Controls') -cne 'ZDR'){throw 'Zero Data Retention confirmation required.'}
$credential=Read-Host 'Groq API key (hidden; never paste it in chat)' -AsSecureString
$pointer=[IntPtr]::Zero
try{
 $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($credential)
 $payload=@{key=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer);freeConfirmed=$true;zdrConfirmed=$true}|ConvertTo-Json -Compress
 $payload | & npm.cmd run ai:configure-free --silent
 if($LASTEXITCODE -ne 0){throw 'Free setup needs review.'}
}finally{
 if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
 $payload=$null;$credential.Dispose()
}
