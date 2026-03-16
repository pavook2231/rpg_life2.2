Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$source = @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

public static class BackgroundCleaner
{
    public static void Remove(string inputPath, string outputPath, int brightnessThreshold, int grayThreshold, int distanceThreshold)
    {
        using (var source = new Bitmap(inputPath))
        using (var bitmap = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
        {
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.Clear(Color.Transparent);
                graphics.DrawImage(source, 0, 0, source.Width, source.Height);
            }

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

            if (queue.Count == 0)
            {
                SaveCopy(bitmap, outputPath);
                return;
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

            Directory.CreateDirectory(Path.GetDirectoryName(outputPath) ?? ".");
            bitmap.Save(outputPath, ImageFormat.Png);
        }
    }

    private static void SaveCopy(Bitmap bitmap, string outputPath)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(outputPath) ?? ".");
        bitmap.Save(outputPath, ImageFormat.Png);
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

$jobs = @(
    @{
        Input = "d:\rpg_life_clean\rpg_life\static\images\war_pers.png"
        Output = "d:\rpg_life_clean\rpg_life\mobile\assets\characters\warrior_base.png"
        Brightness = 206
        Gray = 34
        Distance = 40
    },
    @{
        Input = "d:\rpg_life_clean\rpg_life\static\images\archer_pers.png"
        Output = "d:\rpg_life_clean\rpg_life\mobile\assets\characters\archer_base.png"
        Brightness = 206
        Gray = 34
        Distance = 40
    },
    @{
        Input = "d:\rpg_life_clean\rpg_life\static\images\mag_pers.png"
        Output = "d:\rpg_life_clean\rpg_life\mobile\assets\characters\mage_base.png"
        Brightness = 180
        Gray = 44
        Distance = 48
    },
    @{
        Input = "d:\rpg_life_clean\rpg_life\static\images\armory1.png"
        Output = "d:\rpg_life_clean\rpg_life\mobile\assets\item-icons\armory\armory1.png"
        Brightness = 214
        Gray = 32
        Distance = 36
    },
    @{
        Input = "d:\rpg_life_clean\rpg_life\static\images\armory2.png"
        Output = "d:\rpg_life_clean\rpg_life\mobile\assets\item-icons\armory\armory2.png"
        Brightness = 214
        Gray = 32
        Distance = 36
    },
    @{
        Input = "d:\rpg_life_clean\rpg_life\static\images\armory3.png"
        Output = "d:\rpg_life_clean\rpg_life\mobile\assets\item-icons\armory\armory3.png"
        Brightness = 214
        Gray = 32
        Distance = 36
    },
    @{
        Input = "d:\rpg_life_clean\rpg_life\static\images\armory4.png"
        Output = "d:\rpg_life_clean\rpg_life\mobile\assets\item-icons\armory\armory4.png"
        Brightness = 214
        Gray = 32
        Distance = 36
    },
    @{
        Input = "d:\rpg_life_clean\rpg_life\static\images\armory5.png"
        Output = "d:\rpg_life_clean\rpg_life\mobile\assets\item-icons\armory\armory5.png"
        Brightness = 214
        Gray = 32
        Distance = 36
    },
    @{
        Input = "d:\rpg_life_clean\rpg_life\static\images\armory6.png"
        Output = "d:\rpg_life_clean\rpg_life\mobile\assets\item-icons\armory\armory6.png"
        Brightness = 214
        Gray = 32
        Distance = 36
    },
    @{
        Input = "d:\rpg_life_clean\rpg_life\static\images\armory7.png"
        Output = "d:\rpg_life_clean\rpg_life\mobile\assets\item-icons\armory\armory7.png"
        Brightness = 214
        Gray = 32
        Distance = 36
    },
    @{
        Input = "d:\rpg_life_clean\rpg_life\static\images\armory8.png"
        Output = "d:\rpg_life_clean\rpg_life\mobile\assets\item-icons\armory\armory8.png"
        Brightness = 214
        Gray = 32
        Distance = 36
    }
)

foreach ($job in $jobs) {
    Write-Host "Cleaning $($job.Input) -> $($job.Output)"
    [BackgroundCleaner]::Remove($job.Input, $job.Output, $job.Brightness, $job.Gray, $job.Distance)
}

Write-Host "Done."
