param([switch]$Test, [switch]$MediaTest, [string]$ToolchainRoot, [string]$EasyXRoot)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (!$ToolchainRoot) { $ToolchainRoot = Join-Path $root '.tools\w64devkit' }
if (!$EasyXRoot) { $EasyXRoot = Join-Path $root '.tools\easyx' }
$compiler = Join-Path $ToolchainRoot 'bin\g++.exe'
$windres = Join-Path $ToolchainRoot 'bin\windres.exe'
if (!(Test-Path $compiler) -or !(Test-Path "$EasyXRoot\include\graphics.h")) { throw 'Run scripts/setup.ps1 first, or provide -ToolchainRoot and -EasyXRoot.' }
$dist = Join-Path $root 'dist'
$out = Join-Path $dist 'LinkGame'
New-Item -ItemType Directory -Force $out | Out-Null
& $windres -I "$root\src" "$root\src\app.rc" -o "$dist\app.o"
if ($LASTEXITCODE -ne 0) { throw 'Resource compilation failed.' }
$flags = @('-std=c++11','-O2','-DUNICODE','-D_UNICODE','-static','-finput-charset=UTF-8','-fexec-charset=UTF-8',"-I$EasyXRoot\include", "-I$root\src")
$libs = @("-L$EasyXRoot\lib_mingw_msvcrt\x64",'-leasyxw','-lgdiplus','-lgdi32','-lole32','-lwinmm','-luuid','-lmsimg32')
& $compiler @flags -mwindows "$root\src\main.cpp" "$root\src\llk.cpp" "$dist\app.o" @libs -o "$out\LinkGame.exe"
if ($LASTEXITCODE -ne 0) { throw 'Compilation failed.' }
Copy-Item -LiteralPath "$root\Images","$root\sound" -Destination $out -Recurse -Force
Copy-Item -LiteralPath "$root\README.md" -Destination $out -Force
if ($Test) {
    & $compiler @flags "$root\tests\core_tests.cpp" "$root\src\llk.cpp" "$dist\app.o" @libs -o "$dist\core_tests.exe"
    if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed.' }
    & "$dist\core_tests.exe"
    if ($LASTEXITCODE -ne 0) { throw 'Core tests failed.' }
}
if ($MediaTest) {
    & $compiler -std=c++11 -O2 -static "$root\tests\media_check.cpp" -lgdiplus -lwinmm -o "$dist\media_check.exe"
    if ($LASTEXITCODE -ne 0) { throw 'Media test compilation failed.' }
    & "$dist\media_check.exe" $out
    if ($LASTEXITCODE -ne 0) { throw 'Media test failed.' }
}
Compress-Archive -Path "$out\LinkGame.exe","$out\Images","$out\sound","$out\README.md" -DestinationPath "$dist\LinkGame-v1.0.0-windows-x64.zip" -Force
Write-Host "Built: $out\LinkGame.exe"
