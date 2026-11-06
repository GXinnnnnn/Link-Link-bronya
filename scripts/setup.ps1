param([string]$SevenZip = 'C:\Program Files\7-Zip\7z.exe')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tools = Join-Path $root '.tools'
if (!(Test-Path -LiteralPath $SevenZip)) { throw 'Install 7-Zip or specify -SevenZip with its full path.' }
New-Item -ItemType Directory -Force $tools | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$downloads = @(
    @('https://github.com/skeeto/w64devkit/releases/download/v2.11.0/w64devkit-x64-2.11.0.7z.exe','w64devkit.exe','54C2BB9962E8A30C8270E34C5EFC3D5FEE579F53087FA7D435B95FBBA2AF7B2B',''),
    @('https://easyx.cn/download/EasyX_26.10.25.exe','EasyX.exe','782923F4AB3ABCDA4AD6E54563D3C9DE8A83955DB04481520E6AD3A48EDDC3B7','easyx')
)
foreach ($entry in $downloads) {
    $archive = Join-Path $tools $entry[1]
    if (!(Test-Path $archive)) { Invoke-WebRequest -UseBasicParsing -Uri $entry[0] -OutFile $archive }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $entry[2]) { throw "Checksum mismatch: $archive" }
    $destination = if ($entry[3]) { Join-Path $tools $entry[3] } else { $tools }
    & $SevenZip x $archive "-o$destination" -y | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Extraction failed: $archive" }
}
Write-Host 'Dependencies ready. Run scripts/build.ps1 -Test.'
