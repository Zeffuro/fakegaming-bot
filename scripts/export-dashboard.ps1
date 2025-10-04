# PowerShell: dump all dashboard source files to a single file
# Save as dump-dashboard.ps1 and run from your repo root

# Output file
$outFile = "dashboard-full.txt"
if (Test-Path $outFile) { Remove-Item $outFile }

# Folders to exclude
$exclude = @(".git", "node_modules", ".next", "dist")

# File extensions to include
$includeExt = @(".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".scss", ".html")

# Recursive function to process folders
function Process-Folder($folder) {
    Get-ChildItem -Path $folder -Recurse -File | Where-Object {
        # Exclude unwanted folders
        foreach ($ex in $exclude) {
            if ($_.FullName -like "*\$ex\*") { return $false }
        }
        # Include only desired extensions
        foreach ($ext in $includeExt) {
            if ($_.Extension -eq $ext) { return $true }
        }
        return $false
    } | ForEach-Object {
        $file = $_.FullName
        # Write header
        "==== FILE: $file ====" | Out-File $outFile -Append
        # Write contents
        Get-Content $file | Out-File $outFile -Append
        # Add spacing
        "`n`n" | Out-File $outFile -Append
    }
}

# Process dashboard folder
$dashboardFolder = ".\packages\dashboard"
Process-Folder $dashboardFolder

Write-Host "Done! Output saved to $outFile"
