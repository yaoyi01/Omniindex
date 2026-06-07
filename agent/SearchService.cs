using System;
using System.Collections.Generic;
using System.Data.OleDb;
namespace DesktopSearchAgent
{
    public class SearchResult
    {
        public string Name { get; set; } = "";
        public string Path { get; set; } = "";
        public DateTime DateModified { get; set; }
        public long FileSize { get; set; }
        public string Summary { get; set; } = "";
    }

    public class SearchService
    {
        private const string ConnectionString = "Provider=Search.CollatorDSO;Extended Properties='Application=Windows';";

        public List<SearchResult> QueryIndex(string query)
        {
            var results = new List<SearchResult>();

            using (var connection = new OleDbConnection(ConnectionString))
            {
                try
                {
                    connection.Open();
                    using (var command = new OleDbCommand(query, connection))
                    {
                        command.CommandTimeout = 600;
                        using (var reader = command.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                var item = new SearchResult();

                                if (reader["System.ItemName"] != DBNull.Value)
                                    item.Name = reader["System.ItemName"].ToString() ?? "";

                                if (reader["System.ItemPathDisplay"] != DBNull.Value)
                                    item.Path = reader["System.ItemPathDisplay"].ToString() ?? "";

                                if (reader["System.DateModified"] != DBNull.Value)
                                    item.DateModified = (DateTime)reader["System.DateModified"];

                                if (reader["System.Size"] != DBNull.Value)
                                {
                                    try { item.FileSize = Convert.ToInt64(reader["System.Size"]); } catch { }
                                }

                                string autoSummary = "";
                                string contents = "";

                                try
                                {
                                    if (reader["System.Search.AutoSummary"] != DBNull.Value)
                                        autoSummary = reader["System.Search.AutoSummary"].ToString() ?? "";
                                }
                                catch { }

                                try
                                {
                                    if (reader["System.Search.Contents"] != DBNull.Value)
                                    {
                                        contents = reader["System.Search.Contents"].ToString() ?? "";
                                        if (contents.Length > 2000) contents = contents.Substring(0, 2000) + "...";
                                    }
                                }
                                catch { }

                                if (!string.IsNullOrWhiteSpace(autoSummary))
                                {
                                    item.Summary = autoSummary;
                                }
                                else if (!string.IsNullOrWhiteSpace(contents))
                                {
                                    item.Summary = contents;
                                }
                                else
                                {
                                    item.Summary = item.Name;
                                }

                                results.Add(item);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SearchService Error] {ex.Message}");
                    throw;
                }
            }

            return results;
        }
    }
}
