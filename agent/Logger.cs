using System;
using System.IO;

namespace DesktopSearchAgent
{
    public static class Logger
    {
        private static readonly string LogDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
        private static readonly string LogFile = Path.Combine(LogDir, "agent.log");
        private const long MaxFileSize = 50 * 1024 * 1024;

        static Logger()
        {
            if (!Directory.Exists(LogDir))
            {
                Directory.CreateDirectory(LogDir);
            }
        }

        public static void Info(string message)
        {
            Log($"[INFO] {message}");
        }

        public static void Error(string message)
        {
            Log($"[ERROR] {message}");
        }

        private static void Log(string formattedMessage)
        {
            try
            {
                CheckAndRotateLog();
                string timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                string line = $"{timestamp} {formattedMessage}";

                Console.WriteLine(line);

                File.AppendAllText(LogFile, line + Environment.NewLine);
            }
            catch (Exception)
            {
            }
        }

        private static void CheckAndRotateLog()
        {
            try
            {
                var fileInfo = new FileInfo(LogFile);
                if (fileInfo.Exists && fileInfo.Length > MaxFileSize)
                {
                    string backup = Path.Combine(LogDir, $"agent.log.{DateTime.Now:yyyyMMddHHmmss}.bak");
                    fileInfo.MoveTo(backup);
                }
            }
            catch { }
        }
    }
}
