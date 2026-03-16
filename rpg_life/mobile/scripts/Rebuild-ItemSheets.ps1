Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$source = @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class SpriteSheetTools
{
    public static void ExtractGridSheet(string inputPath, string outputDir, string prefix, int cols, int rows, int brightnessThreshold, int grayThreshold, int distanceThreshold, int alphaThreshold, int canvasSize, int padding)
    {
        using (var cleaned = CreateCleanBitmap(inputPath, brightnessThreshold, grayThreshold, distanceThreshold))
        {
            Directory.CreateDirectory(outputDir);
            var cellWidth = cleaned.Width / cols;
            var cellHeight = cleaned.Height / rows;
            for (var rowIndex = 0; rowIndex < rows; rowIndex++)
            {
                for (var colIndex = 0; colIndex < cols; colIndex++)
                {
                    var x = colIndex * cellWidth;
                    var y = rowIndex * cellHeight;
                    var width = (colIndex == cols - 1) ? (cleaned.Width - x) : cellWidth;
                    var height = (rowIndex == rows - 1) ? (cleaned.Height - y) : cellHeight;
                    var cellRect = new Rectangle(x, y, width, height);
                    var bounds = FindAlphaBounds(cleaned, cellRect, alphaThreshold);
                    var finalRect = bounds.IsEmpty ? cellRect : bounds;
                    var fileName = string.Format("{0}_r{1}c{2}.png", prefix, rowIndex + 1, colIndex + 1);
                    SaveSprite(cleaned, finalRect, Path.Combine(outputDir, fileName), canvasSize, padding);
                }
            }
        }
    }

    private static Bitmap CreateCleanBitmap(string inputPath, int brightnessThreshold, int grayThreshold, int distanceThreshold)
    {
        var source = new Bitmap(inputPath);
        var bitmap = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb);
        using (var graphics = Graphics.FromImage(bitmap))
        {
            graphics.Clear(Color.Transparent);
            graphics.DrawImage(source, 0, 0, source.Width, source.Height);
        }
        source.Dispose();

        var width = bitmap.Width;
        var height = bitmap.Height;
        var visited = new bool[width * height];
        var queue = new Queue<Point>();
        var palette = new List<Color>();

        Action<int, int> enqueueSeed = (x, y) =>
        {
            var index = y * width + x;
            if (visited[index])
            {
                return;
            }

            var color = bitmap.GetPixel(x, y);
            if (!IsSeed(color, brightnessThreshold, grayThreshold))
            {
                return;
            }

            visited[index] = true;
            queue.Enqueue(new Point(x, y));
            if (color.A > 8 && palette.Count < 64)
            {
                palette.Add(color);
            }
        };

        for (var x = 0; x < width; x++)
        {
            enqueueSeed(x, 0);
            enqueueSeed(x, height - 1);
        }

        for (var y = 0; y < height; y++)
        {
            enqueueSeed(0, y);
            enqueueSeed(width - 1, y);
        }

        var offsets = new[]
        {
            new Point(1, 0),
            new Point(-1, 0),
            new Point(0, 1),
            new Point(0, -1),
        };

        while (queue.Count > 0)
        {
            var point = queue.Dequeue();
            bitmap.SetPixel(point.X, point.Y, Color.FromArgb(0, 0, 0, 0));

            foreach (var offset in offsets)
            {
                var nx = point.X + offset.X;
                var ny = point.Y + offset.Y;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height)
                {
                    continue;
                }

                var index = ny * width + nx;
                if (visited[index])
                {
                    continue;
                }

                var color = bitmap.GetPixel(nx, ny);
                if (!IsBackgroundLike(color, palette, brightnessThreshold, grayThreshold, distanceThreshold))
                {
                    continue;
                }

                visited[index] = true;
                queue.Enqueue(new Point(nx, ny));
            }
        }

        RemoveWhiteFringe(bitmap);
        return bitmap;
    }

    private static Rectangle FindAlphaBounds(Bitmap bitmap, Rectangle region, int alphaThreshold)
    {
        var minX = region.Right;
        var minY = region.Bottom;
        var maxX = region.Left - 1;
        var maxY = region.Top - 1;

        for (var y = region.Top; y < region.Bottom; y++)
        {
            for (var x = region.Left; x < region.Right; x++)
            {
                var color = bitmap.GetPixel(x, y);
                if (color.A < alphaThreshold)
                {
                    continue;
                }
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }

        if (maxX < minX || maxY < minY)
        {
            return Rectangle.Empty;
        }

        return Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
    }

    private static void RemoveWhiteFringe(Bitmap bitmap)
    {
        for (var y = 0; y < bitmap.Height; y++)
        {
            for (var x = 0; x < bitmap.Width; x++)
            {
                var color = bitmap.GetPixel(x, y);
                if (color.A == 0)
                {
                    continue;
                }
                var max = Math.Max(color.R, Math.Max(color.G, color.B));
                var min = Math.Min(color.R, Math.Min(color.G, color.B));
                var average = (color.R + color.G + color.B) / 3;
                if (average >= 230 && (max - min) <= 22)
                {
                    bitmap.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                    continue;
                }
                if (color.A <= 72 && average >= 200)
                {
                    bitmap.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                }
            }
        }
    }

    private static void SaveSprite(Bitmap source, Rectangle rect, string outputPath, int canvasSize, int padding)
    {
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
            graphics.DrawImage(source, new Rectangle(destX, destY, drawWidth, drawHeight), rect, GraphicsUnit.Pixel);
            target.Save(outputPath, ImageFormat.Png);
        }
    }

    private static bool IsSeed(Color color, int brightnessThreshold, int grayThreshold)
    {
        if (color.A <= 8)
        {
            return true;
        }
        var max = Math.Max(color.R, Math.Max(color.G, color.B));
        var min = Math.Min(color.R, Math.Min(color.G, color.B));
        var average = (color.R + color.G + color.B) / 3;
        return average >= brightnessThreshold && (max - min) <= grayThreshold;
    }

    private static bool IsBackgroundLike(Color color, List<Color> palette, int brightnessThreshold, int grayThreshold, int distanceThreshold)
    {
        if (color.A <= 8)
        {
            return true;
        }
        var max = Math.Max(color.R, Math.Max(color.G, color.B));
        var min = Math.Min(color.R, Math.Min(color.G, color.B));
        var average = (color.R + color.G + color.B) / 3;
        if (average >= brightnessThreshold && (max - min) <= grayThreshold + 10)
        {
            return true;
        }
        var limit = distanceThreshold * distanceThreshold;
        foreach (var sample in palette)
        {
            var dr = color.R - sample.R;
            var dg = color.G - sample.G;
            var db = color.B - sample.B;
            var distance = (dr * dr) + (dg * dg) + (db * db);
            if (distance <= limit && (max - min) <= grayThreshold + 20)
            {
                return true;
            }
        }
        return false;
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing

$root = 'd:\rpg_life_clean\rpg_life'
$armorDir = Join-Path $root 'mobile\assets\item-icons\armor'
$accessoryDir = Join-Path $root 'mobile\assets\item-icons\accessories'

[SpriteSheetTools]::ExtractGridSheet((Join-Path $root 'static\images\bronya.png'), $armorDir, 'armor', 5, 5, 220, 36, 42, 24, 256, 18)
[SpriteSheetTools]::ExtractGridSheet((Join-Path $root 'static\images\ring_axe.png'), $accessoryDir, 'accessory', 5, 4, 214, 34, 40, 24, 256, 18)

$armorMap = @{
  'armor_1101_leather_armor.png' = 'armor_r2c3.png'
  'armor_1102_chain_helmet.png' = 'armor_r1c2.png'
  'armor_1103_cloth_leggings.png' = 'armor_r3c1.png'
  'armor_1105_leather_boots.png' = 'armor_r4c1.png'
  'armor_1201_steel_breastplate.png' = 'armor_r2c2.png'
  'armor_1202_plate_shoulders.png' = 'armor_r2c5.png'
  'armor_1204_magic_robe.png' = 'armor_r2c4.png'
  'armor_1205_ranger_hood.png' = 'armor_r1c5.png'
  'armor_1301_full_plate.png' = 'armor_r2c5.png'
  'armor_1303_shadow_cloak.png' = 'armor_r5c5.png'
  'armor_1304_wizard_hat.png' = 'armor_r1c4.png'
  'armor_1305_invisibility_cloak.png' = 'armor_r5c5.png'
  'armor_1401_paladin_armor.png' = 'armor_r2c1.png'
  'armor_1402_wind_mail.png' = 'armor_r2c2.png'
  'armor_1403_archmage_robes.png' = 'armor_r5c4.png'
  'armor_1501_immortal_armor.png' = 'armor_r2c1.png'
  'armor_1502_shadow_armor.png' = 'armor_r2c5.png'
  'armor_1503_prophet_robes.png' = 'armor_r5c1.png'
}
$accessoryMap = @{
  'accessory_2101_copper_ring.png' = 'accessory_r1c4.png'
  'accessory_2102_leather_amulet.png' = 'accessory_r2c2.png'
  'accessory_2201_ring_of_strength.png' = 'accessory_r1c3.png'
  'accessory_2202_amulet_of_agility.png' = 'accessory_r2c1.png'
  'accessory_2301_critical_ring.png' = 'accessory_r1c2.png'
  'accessory_2401_dragon_ring.png' = 'accessory_r1c1.png'
  'accessory_2403_shadow_totem.png' = 'accessory_r2c5.png'
  'accessory_2501_ring_of_immortality.png' = 'accessory_r1c5.png'
  'accessory_2502_gods_amulet.png' = 'accessory_r2c1.png'
  'accessory_2503_soul_of_world.png' = 'accessory_r2c4.png'
}

foreach ($pair in $armorMap.GetEnumerator()) {
  Copy-Item -Path (Join-Path $armorDir $pair.Value) -Destination (Join-Path $armorDir $pair.Key) -Force
}
foreach ($pair in $accessoryMap.GetEnumerator()) {
  Copy-Item -Path (Join-Path $accessoryDir $pair.Value) -Destination (Join-Path $accessoryDir $pair.Key) -Force
}
