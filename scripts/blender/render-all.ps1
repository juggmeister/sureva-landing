# Final renders for the site. Output: assets-src/renders/<job>/ (PNG RGBA + meta.json)
$ErrorActionPreference = 'Stop'
$bl = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
$jobs = @(
  @('turn', 'res=2400', 'samples=96', 'lens=105', 'frames=25', 'sweep=30'),
  @('explode', 'res=1600', 'samples=96', 'frames=64'),
  @('views', 'res=2400', 'samples=128')
)
foreach ($j in $jobs) {
  $name = $j[0]
  $sw = [Diagnostics.Stopwatch]::StartNew()
  & $bl -b --factory-startup --python scripts/blender/render.py -- $name "assets-src/renders/$name" @($j[1..($j.Length - 1)]) 2>&1 |
    Select-String -Pattern 'Traceback|Error|done' | ForEach-Object { $_.Line }
  "{0} finished in {1:n0}s" -f $name, $sw.Elapsed.TotalSeconds
}
