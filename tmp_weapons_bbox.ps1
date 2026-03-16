$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$bmp=[System.Drawing.Bitmap]::new('d:\rpg_life_clean\rpg_life\static\images\weapons.png')
$w=[int]$bmp.Width; $h=[int]$bmp.Height
$mask = New-Object 'bool[,]' $w, $h
for($y=0;$y -lt $h;$y++){
  for($x=0;$x -lt $w;$x++){
    if($bmp.GetPixel($x,$y).A -gt 10){ $mask[$x,$y]=$true }
  }
}
$visited = New-Object 'bool[,]' $w, $h
$components = @()
for($sy=0;$sy -lt $h;$sy++){
  for($sx=0;$sx -lt $w;$sx++){
    if(-not $mask[$sx,$sy] -or $visited[$sx,$sy]){ continue }
    $queue = [System.Collections.Generic.Queue[System.ValueTuple[int,int]]]::new()
    $queue.Enqueue([System.ValueTuple[int,int]]::new($sx,$sy))
    $visited[$sx,$sy]=$true
    $minX=$sx; $maxX=$sx; $minY=$sy; $maxY=$sy; $countPix=0
    while($queue.Count -gt 0){
      $pt=$queue.Dequeue(); $x=$pt.Item1; $y=$pt.Item2; $countPix++
      if($x -lt $minX){$minX=$x}; if($x -gt $maxX){$maxX=$x}; if($y -lt $minY){$minY=$y}; if($y -gt $maxY){$maxY=$y}
      foreach($d in @(@(-1,0),@(1,0),@(0,-1),@(0,1))){
        $nx=$x+$d[0]; $ny=$y+$d[1]
        if($nx -lt 0 -or $ny -lt 0 -or $nx -ge $w -or $ny -ge $h){ continue }
        if($visited[$nx,$ny] -or -not $mask[$nx,$ny]){ continue }
        $visited[$nx,$ny]=$true
        $queue.Enqueue([System.ValueTuple[int,int]]::new($nx,$ny))
      }
    }
    if($countPix -ge 300){
      $components += [PSCustomObject]@{ MinX=$minX; MinY=$minY; MaxX=$maxX; MaxY=$maxY; Count=$countPix; CX=[int](($minX+$maxX)/2); CY=[int](($minY+$maxY)/2) }
    }
  }
}
$bmp.Dispose()
$components = $components | Sort-Object CY,CX
Write-Output ('COUNT=' + $components.Count)
$i=1
foreach($c in $components){ Write-Output ("{0}: {1},{2} -> {3},{4} count={5} center={6},{7}" -f $i,$c.MinX,$c.MinY,$c.MaxX,$c.MaxY,$c.Count,$c.CX,$c.CY); $i++ }
