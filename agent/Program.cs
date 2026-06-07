using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Linq;
using System.IO;

namespace DesktopSearchAgent
{
    public class FileRecord
    {
        [JsonProperty("name")]
        public string Name { get; set; } = "";

        [JsonProperty("path")]
        public string Path { get; set; } = "";

        [JsonProperty("size")]
        public long Size { get; set; }

        [JsonProperty("date_modified")]
        public string DateModified { get; set; } = "";

        [JsonProperty("summary")]
        public string Summary { get; set; } = "";
    }

    public class AgentUploadRequest
    {
        [JsonProperty("agent_id")]
        public string AgentId { get; set; } = "";

        [JsonProperty("hostname")]
        public string Hostname { get; set; } = "";

        [JsonProperty("files")]
        public List<FileRecord> Files { get; set; } = new List<FileRecord>();
    }

    public class HeartbeatRequest
    {
        [JsonProperty("agent_id")]
        public string AgentId { get; set; } = "";

        [JsonProperty("hostname")]
        public string Hostname { get; set; } = "";

        [JsonProperty("version")]
        public string Version { get; set; } = "1.0.0";

        [JsonProperty("ip_address")]
        public string IpAddress { get; set; } = "";

        [JsonProperty("mac_address")]
        public string MacAddress { get; set; } = "";
    }

    class Program
    {
        private static readonly HttpClient client = new HttpClient();
        // Default server URL — overridden by config.json
        private static string BASE_URL = "http://127.0.0.1:8001/api/v1";
        private static string UPLOAD_URL => BASE_URL + "/agent/upload";
        private static string CONFIG_URL => BASE_URL + "/config";
        private static string HEARTBEAT_URL => BASE_URL + "/agent/heartbeat";

        public class LocalConfig
        {
            public string ServerUrl { get; set; } = "http://127.0.0.1:8001";
        }

        public class AgentConfig
        {
            [JsonProperty("collection_limit")]
            public int CollectionLimit { get; set; } = 1000;

            [JsonProperty("interval_seconds")]
            public int IntervalSeconds { get; set; } = 3600;

            [JsonProperty("allowed_extensions")]
            public List<string> AllowedExtensions { get; set; } = new List<string>();
        }

        static async Task Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Logger.Info("Desktop Search Agent - Managed Mode (v1.2 .NET 4.8)");
            Logger.Info("==============================================");

            LoadLocalSettings();

            string agentId = AgentIdentity.GetAgentId();
            string hostname = Environment.MachineName;

            Logger.Info($"[Identity] Agent ID: {agentId}");
            Logger.Info($"[Identity] Hostname: {hostname}");

            int intervalSeconds = 3600;

            while (true)
            {
                try
                {
                    await SendHeartbeat(agentId, hostname);
                    intervalSeconds = await RunCollectionCycle(agentId, hostname);
                }
                catch (Exception ex)
                {
                    Logger.Error($"[Main Loop Error] {ex.Message}");
                }

                Logger.Info($"[Scheduler] Next collection in {intervalSeconds} seconds...");
                await Task.Delay(TimeSpan.FromSeconds(intervalSeconds));
            }
        }

        private static void LoadLocalSettings()
        {
            string configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
            if (File.Exists(configPath))
            {
                try
                {
                    string json = File.ReadAllText(configPath);
                    var config = JsonConvert.DeserializeObject<LocalConfig>(json);
                    if (config != null && !string.IsNullOrWhiteSpace(config.ServerUrl))
                    {
                        string url = config.ServerUrl.TrimEnd('/');
                        BASE_URL = url + "/api/v1";
                        Logger.Info($"[Config] Using Server: {url}");
                    }
                }
                catch (Exception ex)
                {
                    Logger.Error($"[Config] Failed to load config.json: {ex.Message}");
                }
            }
            else
            {
                try
                {
                    var defaultConfig = new LocalConfig();
                    string json = JsonConvert.SerializeObject(defaultConfig, Formatting.Indented);
                    File.WriteAllText(configPath, json);
                    Logger.Info($"[Config] Created default config.json at {configPath}");
                }
                catch { }
            }
        }

        private static async Task SendHeartbeat(string agentId, string hostname)
        {
            try
            {
                string ipAddress = "";
                try
                {
                    var host = System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName());
                    foreach (var ip in host.AddressList)
                    {
                        if (ip.AddressFamily == AddressFamily.InterNetwork)
                        {
                            ipAddress = ip.ToString();
                            break;
                        }
                    }
                }
                catch { }

                string macAddress = "";
                try
                {
                    var interfaces = NetworkInterface.GetAllNetworkInterfaces()
                        .Where(nic => nic.OperationalStatus == OperationalStatus.Up && nic.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                        .OrderByDescending(nic => nic.NetworkInterfaceType == NetworkInterfaceType.Ethernet || nic.NetworkInterfaceType == NetworkInterfaceType.Wireless80211)
                        .ToList();

                    foreach (var nic in interfaces)
                    {
                        var physAddr = nic.GetPhysicalAddress();
                        if (physAddr == null) continue;

                        var tempMac = physAddr.ToString();
                        if (string.IsNullOrEmpty(tempMac)) continue;

                        Logger.Info($"[Network] Found Candidate: {nic.Name} ({nic.NetworkInterfaceType}) - MAC: {tempMac}");

                        if (tempMac.Length == 12)
                        {
                            macAddress = string.Join(":", Enumerable.Range(0, 6).Select(i => tempMac.Substring(i * 2, 2)));
                            Logger.Info($"[Network] Selected MAC: {macAddress}");
                            break;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Logger.Error($"[Network] MAC Retrieval Failed: {ex.Message}");
                }

                var payload = new HeartbeatRequest
                {
                    AgentId = agentId,
                    Hostname = hostname,
                    IpAddress = ipAddress,
                    MacAddress = macAddress
                };
                var json = JsonConvert.SerializeObject(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await client.PostAsync(HEARTBEAT_URL, content);
                if (response.IsSuccessStatusCode)
                {
                    Logger.Info("Heartbeat sent successfully.");
                }
                else
                {
                    Logger.Info($"Heartbeat failed: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                Logger.Info($"Heartbeat connection error: {ex.Message}");
            }
        }

        private static async Task<int> RunCollectionCycle(string agentId, string hostname)
        {
            int limit = 0;
            int intervalSeconds = 3600;
            List<string> allowedExtensions = new List<string>();
            try
            {
                Logger.Info("Fetching server configuration...");
                var configStr = await client.GetStringAsync(CONFIG_URL);
                var config = JsonConvert.DeserializeObject<AgentConfig>(configStr);
                if (config != null)
                {
                    limit = config.CollectionLimit;
                    if (config.IntervalSeconds > 0) intervalSeconds = config.IntervalSeconds;
                    if (config.AllowedExtensions != null && config.AllowedExtensions.Count > 0)
                        allowedExtensions = config.AllowedExtensions;
                }
                Logger.Info($"[Config] Limit={limit}, Interval={intervalSeconds}s, ExtTypes={allowedExtensions.Count}");
            }
            catch (Exception ex)
            {
                Logger.Info($"[WARN] Failed to fetch config, using default. Error: {ex.Message}");
            }

            try
            {
                string extensionFilter = "";
                if (allowedExtensions.Count > 0)
                {
                    var conditions = allowedExtensions.Select(ext =>
                    {
                        string safeExt = (ext.StartsWith(".") ? ext : "." + ext).Replace("'", "''");
                        return $"System.ItemName LIKE '%{safeExt}'";
                    });
                    extensionFilter = " AND (" + string.Join(" OR ", conditions) + ")";
                    Logger.Info($"[Filter] Restricting to: {string.Join(", ", allowedExtensions)}");
                }
                else
                {
                    Logger.Info("[Filter] No extension filter — collecting all file types.");
                }

                string queryLog = limit <= 0 ? "UNLIMITED" : limit.ToString();
                Logger.Info($"Querying Windows Search Index (Limit: {queryLog})...");

                var searcher = new SearchService();
                int effectiveLimit = (limit <= 0) ? 2000000 : limit;
                var query = $"SELECT TOP {effectiveLimit} System.ItemName, System.ItemPathDisplay, System.DateModified, System.Size, System.Search.AutoSummary, System.Search.Contents FROM SystemIndex WHERE Scope='file:' AND System.Kind <> 'folder' AND System.ItemName NOT LIKE '%.settingcontent-ms' AND System.ItemName NOT LIKE '%.tmp'{extensionFilter}";
                var results = searcher.QueryIndex(query);

                Logger.Info($"Found {results.Count} items. Starting batch upload...");

                int total = results.Count;
                int batchSize = 50;
                int processed = 0;

                for (int i = 0; i < total; i += batchSize)
                {
                    var batch = results.GetRange(i, Math.Min(batchSize, total - i));

                    var payload = new AgentUploadRequest
                    {
                        AgentId = agentId,
                        Hostname = hostname,
                        Files = new List<FileRecord>()
                    };

                    foreach (var item in batch)
                    {
                        payload.Files.Add(new FileRecord
                        {
                            Name = item.Name,
                            Path = item.Path,
                            Size = item.FileSize,
                            DateModified = item.DateModified.ToString("o"),
                            Summary = !string.IsNullOrWhiteSpace(item.Summary) ? item.Summary : item.Name
                        });
                    }

                    try
                    {
                        var json = JsonConvert.SerializeObject(payload);
                        var content = new StringContent(json, Encoding.UTF8, "application/json");
                        var response = await client.PostAsync(UPLOAD_URL, content);

                        processed += batch.Count;
                        if (processed % 500 == 0 || processed == total)
                        {
                            Logger.Info($"Progress: {processed}/{total} ({(double)processed / total:P0}) uploaded.");
                        }
                    }
                    catch (Exception ex)
                    {
                        Logger.Error($"\n[Error batch {i}] {ex.Message}");
                    }
                }

                Logger.Info("\nFull collection completed.");
            }
            catch (Exception ex)
            {
                Logger.Error($"\n[Collection Error]: {ex.Message}");
            }

            return intervalSeconds;
        }
    }
}
