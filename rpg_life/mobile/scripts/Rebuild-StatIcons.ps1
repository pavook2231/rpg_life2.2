Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$source = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class ManualStatSheetTools
{
    public static void SaveCropped(string inputPath, string outputPath, int x, int y, int width, int height, int canvasSize, int padding, int darkThreshold)
    {
        using (var source = new Bitmap(inputPath))
        using (var cropped = CropRegion(source, x, y, width, height))
        using (var cleaned = RemoveDarkBackground(cropped, darkThreshold))
        using (var target = new Bitmap(canvasSize, canvasSize, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(target))
        {
            graphics.Clear(Color.Transparent);
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
            graphics.SmoothingMode = SmoothingMode.HighQuality;
            graphics.CompositingQuality = CompositingQuality.HighQuality;

            var rect = TrimAlphaBounds(cleaned);
            var available = canvasSize - padding * 2;
            var scale = Math.Min((float)available / rect.Width, (float)available / rect.Height);
            var drawWidth = Math.Max(1, (int)Math.Round(rect.Width * scale));
            var drawHeight = Math.Max(1, (int)Math.Round(rect.Height * scale));
            var destX = (canvasSize - drawWidth) / 2;
            var destY = (canvasSize - drawHeight) / 2;
            graphics.DrawImage(cleaned, new Rectangle(destX, destY, drawWidth, drawHeight), rect, GraphicsUnit.Pixel);

            Directory.CreateDirectory(Path.GetDirectoryName(outputPath) ?? ".");
            target.Save(outputPath, ImageFormat.Png);
        }
    }

    private static Bitmap CropRegion(Bitmap source, int x, int y, int width, int height)
    {
        var result = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        using (var graphics = Graphics.FromImage(result))
        {
            graphics.Clear(Color.Transparent);
            graphics.DrawImage(source, new Rectangle(0, 0, width, height), new Rectangle(x, y, width, height), GraphicsUnit.Pixel);
        }
        return result;
    }

    private static Bitmap RemoveDarkBackground(Bitmap source, int darkThreshold)
    {
        var result = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb);
        for (var y = 0; y < source.Height; y++)
        {
            for (var x = 0; x < source.Width; x++)
            {
                var color = source.GetPixel(x, y);
                var avg = (color.R + color.G + color.B) / 3;
                if (avg <= darkThreshold)
                {
                    result.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                }
                else
                {
                    result.SetPixel(x, y, color);
                }
            }
        }
        return result;
    }

    private static Rectangle TrimAlphaBounds(Bitmap bitmap)
    {
        var minX = bitmap.Width;
        var minY = bitmap.Height;
        var maxX = -1;
        var maxY = -1;
        for (var y = 0; y < bitmap.Height; y++)
        {
            for (var x = 0; x < bitmap.Width; x++)
            {
                if (bitmap.GetPixel(x, y).A == 0) continue;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
        if (maxX < minX || maxY < minY) return new Rectangle(0, 0, bitmap.Width, bitmap.Height);
        return Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
    }
}
"@
Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing

$root = 'd:\rpg_life_clean\rpg_life'
$input = Join-Path $root 'static\images\charakter.png'
$out = Join-Path $root 'mobile\assets\stat-icons'

$rects = @{
  'strength.png' = @(20, 70, 300, 320)
  'agility.png' = @(340, 80, 330, 310)
  'intellect.png' = @(675, 70, 305, 310)
  'stamina.png' = @(30, 470, 295, 330)
  'crit.png' = @(350, 490, 330, 295)
  'luck.png' = @(700, 470, 280, 330)
  'xp_bonus.png' = @(0, 900, 360, 340)
  'mana.png' = @(340, 900, 340, 340)
  'armor.png' = @(675, 860, 330, 390)
}
foreach ($entry in $rects.GetEnumerator()) {
  [ManualStatSheetTools]::SaveCropped($input, (Join-Path $out $entry.Key), $entry.Value[0], $entry.Value[1], $entry.Value[2], $entry.Value[3], 192, 8, 46)
}
