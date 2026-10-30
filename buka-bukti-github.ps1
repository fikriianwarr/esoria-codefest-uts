# Buka tautan bukti UTS dengan benar. URL bukan perintah PowerShell.
[CmdletBinding()]
param([switch]$BukaBrowser)
$urls = [ordered]@{
    'Repository' = 'https://github.com/fikriianwarr/esoria-codefest-uts'
    'Workflow CI/CD' = 'https://github.com/fikriianwarr/esoria-codefest-uts/blob/main/.github/workflows/esoria-ci-cd.yml'
    'GitHub Actions Run 2' = 'https://github.com/fikriianwarr/esoria-codefest-uts/actions/runs/40434638852'
}
foreach ($entry in $urls.GetEnumerator()) {
    Write-Host ($entry.Key + ': ' + $entry.Value)
    if ($BukaBrowser) { Start-Process -FilePath $entry.Value }
}
Write-Host 'Tautan GitHub adalah bukti terpisah, bukan bukti image lokal memakai commit GitHub.'
