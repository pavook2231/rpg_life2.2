$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$bmp=[System.Drawing.Bitmap]::new('d:\rpg_life_clean\rpg_life\static\images\weapons.png')
$out='d:\rpg_life_clean\rpg_life\mobile\assets\item-icons\weapons\components'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$components = @(
  @(56,74,187,210),
  @(242,72,374,211),
  @(622,73,751,212),
  @(431,72,565,215),
  @(809,73,955,214),
  @(811,277,962,412),
  @(233,279,383,411),
  @(425,279,568,411),
  @(615,278,765,412),
  @(55,281,198,410),
  @(511,472,555,516),
  @(244,472,369,604),
  @(58,473,183,605),
  @(619,471,745,608),
  @(818,473,948,611),
  @(432,481,551,607),
  @(618,664,756,800),
  @(817,667,958,799),
  @(432,666,563,801),
  @(245,670,371,800),
  @(60,671,188,800)
)
$index=1
foreach($c in $components){
  $x=$c[0]; $y=$c[1]; $w=$c[2]-$c[0]+1; $h=$c[3]-$c[1]+1
  $crop = New-Object System.Drawing.Bitmap($w,$h)
  $g=[System.Drawing.Graphics]::FromImage($crop)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0,0,$w,$h)), (New-Object System.Drawing.Rectangle($x,$y,$w,$h)), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $canvas = New-Object System.Drawing.Bitmap(256,256)
  $gc=[System.Drawing.Graphics]::FromImage($canvas)
  $gc.Clear([System.Drawing.Color]::Transparent)
  $gc.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scale=[Math]::Min(220/$w,220/$h)
  $dw=[int][Math]::Round($w*$scale); $dh=[int][Math]::Round($h*$scale)
  $dx=[int][Math]::Round((256-$dw)/2); $dy=[int][Math]::Round((256-$dh)/2)
  $gc.DrawImage($crop,$dx,$dy,$dw,$dh)
  $gc.Dispose(); $crop.Dispose()
  $canvas.Save((Join-Path $out ("component_{0}.png" -f $index)), [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose(); $index++
}
$bmp.Dispose()
