Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$source = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class IconCleaner
{
    public static void RemoveSolidBackground(string inputPath, string outputPath, int tolerance, int canvasSize, int padding)
    {
        using (var source = new Bitmap(inputPath))
        {
            var background = source.GetPixel(0, 0);
            using (var cleaned = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
            {
                for (var y = 0; y < source.Height; y++)
                {
                    for (var x = 0; x < source.Width; x++)
                    {
                        var color = source.GetPixel(x, y);
                        if (IsClose(color, background, tolerance))
                        {
                            cleaned.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                        }
                        else
                        {
                            cleaned.SetPixel(x, y, color);
                        }
                    }
                }

                var rect = TrimAlphaBounds(cleaned);
                using (var target = new Bitmap(canvasSize, canvasSize, PixelFormat.Format32bppArgb))
                using (var graphics = Graphics.FromImage(target))
                {
                    graphics.Clear(Color.Transparent);
                    graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    graphics.SmoothingMode = SmoothingMode.HighQuality;
                    graphics.CompositingQuality = CompositingQuality.HighQuality;

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
        }
    }

    private static bool IsClose(Color color, Color background, int tolerance)
    {
        return Math.Abs(color.R - background.R) <= tolerance
            && Math.Abs(color.G - background.G) <= tolerance
            && Math.Abs(color.B - background.B) <= tolerance;
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

$root='d:\rpg_life_clean\rpg_life'
[IconCleaner]::RemoveSolidBackground((Join-Path $root 'static\images\power.png'), (Join-Path $root 'mobile\assets\stat-icons\strength.png'), 24, 192, 8)
[IconCleaner]::RemoveSolidBackground((Join-Path $root 'static\images\arrow.png'), (Join-Path $root 'mobile\assets\stat-icons\agility.png'), 24, 192, 8)
[IconCleaner]::RemoveSolidBackground((Join-Path $root 'static\images\intelect.png'), (Join-Path $root 'mobile\assets\stat-icons\intellect.png'), 24, 192, 8)
