$destination = Join-Path $PSScriptRoot '..\assets-source\polyhaven'
foreach ($asset in @('portable_generator', 'utility_box_02')) {
  $folder = Join-Path $destination $asset
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
  $entry = (Invoke-RestMethod "https://api.polyhaven.com/files/$asset").gltf.'1k'.gltf
  Invoke-WebRequest -Uri $entry.url -OutFile (Join-Path $folder "$asset.gltf")
  foreach ($part in $entry.include.PSObject.Properties) {
    $path = Join-Path $folder $part.Name
    New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
    Invoke-WebRequest -Uri $part.Value.url -OutFile $path
  }
}
