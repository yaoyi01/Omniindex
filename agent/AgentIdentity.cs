using System;
using System.Management;
using System.Security.Cryptography;
using System.Text;

namespace DesktopSearchAgent
{
    public static class AgentIdentity
    {
        private static string _cachedId = "";

        public static string GetAgentId()
        {
            if (!string.IsNullOrEmpty(_cachedId)) return _cachedId;

            try
            {
                if (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Windows))
                {
                    using (var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS"))
                    {
                        foreach (ManagementObject obj in searcher.Get())
                        {
                            var serial = obj["SerialNumber"]?.ToString()?.Trim();
                            if (!string.IsNullOrEmpty(serial) && serial != "To be filled by O.E.M.")
                            {
                                _cachedId = serial;
                                return _cachedId;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Identity] Warn: Failed to read BIOS Serial ({ex.Message})");
            }

            _cachedId = System.Environment.MachineName;
            return _cachedId;
        }
    }
}
