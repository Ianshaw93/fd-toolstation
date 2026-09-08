# Register the localhost manifest with desktop Word (Windows) so it appears under
# Insert > Add-ins > My Add-ins > Developer Add-ins and on the Home tab.
# No Exchange involved: Word reads the manifest path straight from this registry key.
# Run once, then restart Word. Remove with:  -Remove
param([switch]$Remove)

$manifest = Join-Path $PSScriptRoot 'manifest.word.localhost.xml'
$key = 'HKCU:\Software\Microsoft\Office\16.0\WEF\Developer'
$name = 'fdg-word-tools-local'

if ($Remove) {
    Remove-ItemProperty -Path $key -Name $name -ErrorAction SilentlyContinue
    Write-Host "Removed $name from $key. Restart Word."
    exit 0
}

if (-not (Test-Path $manifest)) { throw "manifest not found: $manifest" }
[xml]$xml = Get-Content $manifest
$id = $xml.OfficeApp.Id
New-Item -Path $key -Force | Out-Null
New-ItemProperty -Path $key -Name $name -Value $manifest -PropertyType String -Force | Out-Null
Write-Host "Registered $manifest (Id $id) as $name under $key."
Write-Host "Now: 1) make sure the pane is served:  npx next dev --experimental-https -p 3100"
Write-Host "     2) restart Word; the 'FD Word Tools' button is on the Home tab."
Write-Host "     If Word shows a certificate error, trust the dev CA once by opening https://localhost:3100 in Edge."
