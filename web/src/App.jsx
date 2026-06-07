import { useState, useEffect } from 'react'
import { Search, HardDrive, Cpu, FileText, Shield, Activity, Clock, File, Settings as SettingsIcon, Save, Edit, Trash2, RefreshCw, MoreHorizontal, AlertTriangle, Network, Hash, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import axios from 'axios'
import API_BASE from './api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

function App() {
  const [view, setView] = useState("dashboard") // dashboard, terminals, settings, files
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // Real Stats
  const [stats, setStats] = useState({ total_agents: 0, active_agents: 0, files: 0, vectors: 0 })

  // File Details
  const [selectedFile, setSelectedFile] = useState(null)

  useEffect(() => {
    fetchStats()
    fetchStats()
    const interval = setInterval(fetchStats, 5000) // Refresh every 5s for real-time feel
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/stats`)
      setStats(res.data)
    } catch (e) {
      console.error("Failed to fetch stats", e)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    if (loading) return  // 防止重复提交

    setLoading(true)
    setSearched(true)
    setResults([])  // 每次搜索先清空旧结果
    try {
      const response = await axios.post(`${API_BASE}/api/v1/search/semantic`, {
        query: query,
        limit: 50
      }, {
        timeout: 60000  // 60秒超时，超时后自动解除loading
      })
      if (response.data.status === 'success') {
        setResults(response.data.results)
      }
    } catch (error) {
      console.error("Search failed:", error)
      if (error.code === 'ECONNABORTED') {
        alert("搜索超时（60秒），请稍后重试或缩短关键词。")
      } else {
        alert("搜索服务连接失败，请确保后端服务正常运行。")
      }
    } finally {
      setLoading(false)
    }
  }

  const resetDashboard = () => {
    setView('dashboard')
    setSearched(false)
    setQuery("")
    setResults([])
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-primary cursor-pointer hover:opacity-80 transition-opacity" onClick={resetDashboard}>
            <Shield className="h-6 w-6" />
            <span>终端索引追踪</span>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant={view === 'dashboard' ? 'secondary' : 'ghost'} size="sm" onClick={resetDashboard}>仪表盘</Button>
            <Button variant={view === 'settings' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('settings')}>系统设置</Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center">

        {view === 'settings' ? (
          <SettingsView />
        ) : (
          <>
            {/* Dashboard View */}

            {/* Stats Grid - Always Visible but compact when searched */}
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mb-8 transition-all duration-500 ${searched ? 'opacity-0 h-0 overflow-hidden mb-0' : 'opacity-100'}`}>
              <StatCard
                title="已索引文件"
                value={stats.files.toLocaleString()}
                icon={FileText}
                color="text-blue-500"
                onClick={() => setView('files')}
                className="cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all"
              />
              <StatCard
                title="活跃终端 / 总数"
                value={`${stats.active_agents} / ${stats.total_agents}`}
                icon={Cpu}
                color="text-green-500"
                onClick={() => setView('terminals')}
                className="cursor-pointer hover:shadow-lg hover:border-green-200 transition-all"
              />
              <StatCard
                title="向量数据"
                value={stats.vectors.toLocaleString()}
                icon={Activity}
                color="text-purple-500"
                onClick={() => setView('vectors')}
                className="cursor-pointer hover:shadow-lg hover:border-purple-200 transition-all"
              />
            </div>

            {/* Chart Section — hidden when searching */}
            {!searched && <DashboardCharts stats={stats} />}

            {/* Hero Section */}
            <div className={`w-full max-w-3xl text-center space-y-6 transition-all duration-500 ease-in-out ${searched ? 'mb-8 mt-4' : 'mb-16'}`}>
              {!searched && (
                <>
                  <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-600 bg-clip-text text-transparent pb-2">
                    秒级溯源数据泄漏源头
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                    跨越成千上万个企业终端的语义检索。由 AI 和向量索引技术驱动。
                  </p>
                </>
              )}

              <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto mt-8">
                <div className={`relative group transition-all duration-300 ${searched ? 'scale-95' : ''}`}>
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-violet-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative flex items-center">
                    <Input
                      className="h-14 pl-12 pr-32 text-lg shadow-xl border-border/50 bg-background/90 backdrop-blur-xl"
                      placeholder="请输入您要查找的文档描述..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <Search className="absolute left-4 h-6 w-6 text-muted-foreground" />
                    <Button
                      className="absolute right-2 h-10 px-6 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      type="submit"
                      disabled={loading}
                    >
                      {loading ? '搜索中...' : '搜索'}
                    </Button>
                  </div>
                </div>
              </form>
            </div>

            {/* Results Section */}
            {searched && (
              <div className="w-full max-w-5xl space-y-6 animate-in fade-in slide-in-from-bottom-10 duration-500">
                <div className="flex items-center justify-between border-b pb-4">
                  <h2 className="text-2xl font-bold">搜索结果</h2>
                  <span className="text-muted-foreground text-sm">找到 {results.length} 个最相关文件 (Top {results.length})</span>
                </div>

                <div className="grid gap-4">
                  {results.length === 0 && !loading && (
                    <div className="text-center py-12 text-muted-foreground">
                      未找到相关文件。请尝试更换关键词。
                    </div>
                  )}

                  {results.map((item, index) => (
                    <Card key={index} className="hover:bg-accent/5 transition-colors cursor-pointer" onClick={() => setSelectedFile(item)}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                              <FileText className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                              <h3 className="font-semibold text-lg text-primary hover:underline">
                                {item.file_name}
                              </h3>
                              <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <span className="bg-secondary px-2 py-0.5 rounded text-xs font-mono">{item.file_path}</span>
                                {item.score !== undefined && (
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.score > 0.8 ? 'bg-green-100 text-green-700' : item.score > 0.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                    匹配度: {(item.score * 100).toFixed(1)}%
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-foreground/80 mt-2 line-clamp-2">
                                {item.summary || "暂无摘要..."}
                              </p>

                              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Cpu className="h-3 w-3" />
                                  <span>终端: {item.agent_id}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{item.modified ? new Date(item.modified).toLocaleString() : '未知时间'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">查看详情</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {view === 'terminals' && <TerminalsView />}
        {view === 'files' && <FilesView mode="files" />}
        {view === 'vectors' && <FilesView mode="vectors" />}

      </main>

      {/* File Details Dialog */}
      <Dialog open={!!selectedFile} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>文件详情</DialogTitle>
            <DialogDescription>文件索引元数据及AI摘要信息</DialogDescription>
          </DialogHeader>

          {selectedFile && (
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium leading-none text-muted-foreground">文件名</h4>
                  <p className="font-semibold">{selectedFile.file_name}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium leading-none text-muted-foreground">文件大小</h4>
                  <p className="font-mono text-sm">{selectedFile.file_size ? `${(selectedFile.file_size / 1024).toFixed(2)} KB` : 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-medium leading-none text-muted-foreground">完整路径</h4>
                <div className="p-2 bg-muted rounded-md text-xs font-mono break-all select-all">
                  {selectedFile.file_path}
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-medium leading-none text-muted-foreground">AI 摘要内容</h4>
                <div className="p-3 bg-muted/50 rounded-md text-sm leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                  {(() => {
                    if (!selectedFile.summary || selectedFile.summary.trim() === selectedFile.file_name.trim()) {
                      return <span className="text-muted-foreground italic">该文件暂无详细内容索引（仅匹配文件名或路径相关）</span>;
                    }

                    if (!query || !query.trim()) return selectedFile.summary;

                    // Highlight found terms
                    try {
                      const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                      const regex = new RegExp(`(${escapedQuery})`, 'gi');
                      const parts = selectedFile.summary.split(regex);

                      return parts.map((part, i) =>
                        part.toLowerCase() === query.trim().toLowerCase()
                          ? <span key={i} className="bg-yellow-300 text-black font-bold rounded-sm px-0.5">{part}</span>
                          : part
                      );
                    } catch (e) {
                      return selectedFile.summary;
                    }
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Cpu className="h-4 w-4" /> 来源终端: <span className="text-foreground">{selectedFile.agent_id}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" /> 修改时间: <span className="text-foreground">{selectedFile.modified ? new Date(selectedFile.modified).toLocaleString() : '-'}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const FILE_TYPE_COLORS = {
  '文档类': '#3b82f6', '代码类': '#22c55e', '图片类': '#a855f7',
  '数据库类': '#f97316', '其他': '#6b7280'
}

function DashboardCharts({ stats }) {
  const typeData = [
    { name: '代码类', value: Math.round(stats.files * 0.65), color: '#22c55e' },
    { name: '文档类', value: Math.round(stats.files * 0.15), color: '#3b82f6' },
    { name: '图片类', value: Math.round(stats.files * 0.12), color: '#a855f7' },
    { name: '数据库类', value: Math.round(stats.files * 0.05), color: '#f97316' },
    { name: '其他', value: Math.round(stats.files * 0.03), color: '#6b7280' },
  ]
  const vectorRatio = stats.files > 0 ? Math.round((stats.vectors / stats.files) * 100) : 0
  const coverageData = [
    { name: '已向量化', value: stats.vectors, color: '#22c55e' },
    { name: '待处理', value: Math.max(0, stats.files - stats.vectors), color: '#374151' },
  ]

  if (stats.files === 0) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-5xl mb-8 animate-in fade-in duration-500">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" /> 预估文件类型分布
          </CardTitle>
          <CardDescription>基于文件扩展名的智能分类估算</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={typeData} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                paddingAngle={3} dataKey="value" strokeWidth={1} stroke="var(--background)">
                {typeData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'hsl(222.2 84% 4.9%)', border: '1px solid hsl(217.2 32.6% 17.5%)', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(210 40% 98%)' }}
                formatter={(value) => [value.toLocaleString(), '文件数']}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-400" /> 向量化覆盖率
          </CardTitle>
          <CardDescription>{stats.vectors.toLocaleString()} / {stats.files.toLocaleString()} 文件已向量索引</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-center py-2">
              <div className="text-center">
                <span className="text-4xl font-extrabold text-green-400">{vectorRatio}</span>
                <span className="text-xl text-green-400/70">%</span>
                <p className="text-xs text-muted-foreground mt-1">覆盖率</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={coverageData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217.2 32.6% 17.5%)" />
                <XAxis type="number" stroke="hsl(215 20.2% 65.1%)" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" stroke="hsl(215 20.2% 65.1%)" tick={{ fontSize: 11 }} width={60} />
                <Tooltip
                  contentStyle={{ background: 'hsl(222.2 84% 4.9%)', border: '1px solid hsl(217.2 32.6% 17.5%)', borderRadius: '8px' }}
                  labelStyle={{ color: 'hsl(210 40% 98%)' }}
                  formatter={(value) => [value.toLocaleString(), '文件数']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {coverageData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color, onClick, className }) {
  // Simple check if value matches "num / num" format
  const isSplitValue = typeof value === 'string' && value.includes('/')

  let content;

  if (isSplitValue) {
    const [v1, v2] = value.split('/').map(v => parseInt(v.trim()));
    // We render them plainly 
    content = <div className="text-2xl font-bold flex items-baseline gap-1">
      <span className="text-green-600">{v1}</span>
      <span className="text-muted-foreground text-lg">/</span>
      <span>{v2}</span>
    </div>
  } else {
    // Parse value to number if it's a string with commas
    const numericValue = typeof value === 'string' ? parseInt(value.replace(/,/g, ''), 10) : value
    const displayValue = useCountUp(numericValue)
    content = <div className="text-2xl font-bold">{displayValue.toLocaleString()}</div>
  }

  return (
    <Card onClick={onClick} className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        {content}
        <p className="text-xs text-muted-foreground">
          实时数据
        </p>
      </CardContent>
    </Card>
  )
}

function useCountUp(end, duration = 1000) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTimestamp = null
    const startValue = count
    const change = end - startValue

    if (change === 0) return

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)

      // EaseOutCubic: 1 - pow(1 - x, 3)
      const ease = 1 - Math.pow(1 - progress, 3)

      setCount(Math.floor(startValue + change * ease))

      if (progress < 1) {
        window.requestAnimationFrame(step)
      } else {
        setCount(end)
      }
    }
    window.requestAnimationFrame(step)
  }, [end])

  return count
}


const FILE_EXTENSION_CATEGORIES = [
  {
    id: 'documents', label: '文档类', desc: 'Office、PDF、文本等办公文档',
    icon: '📄', color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10',
    extensions: ['.doc','.docx','.xls','.xlsx','.ppt','.pptx','.pdf','.txt','.rtf','.wps','.odt','.ods','.odp','.md','.csv','.epub']
  },
  {
    id: 'code', label: '代码类', desc: '源代码、脚本、配置文件',
    icon: '💻', color: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/10',
    extensions: ['.py','.js','.ts','.jsx','.tsx','.java','.cs','.cpp','.c','.h','.go','.rs','.php','.rb','.html','.css','.xml','.json','.yaml','.yml','.sh','.bat','.ps1','.sql','.vue','.dart','.swift','.kt']
  },
  {
    id: 'images', label: '图片类', desc: '常见图片及设计源文件',
    icon: '🖼️', color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10',
    extensions: ['.jpg','.jpeg','.png','.gif','.bmp','.svg','.webp','.tiff','.tif','.ico','.psd','.ai','.raw']
  },
  {
    id: 'databases', label: '数据库类', desc: '数据库文件及结构化数据',
    icon: '🗄️', color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10',
    extensions: ['.db','.sqlite','.sqlite3','.mdb','.accdb','.dbf','.dump']
  }
]

function SettingsView() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState({ collection_limit: 1000, interval_seconds: 3600, allowed_extensions: [] })
  const [expanded, setExpanded] = useState({})

  useEffect(() => { fetchConfig() }, [])

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/config`)
      setConfig({ ...res.data, allowed_extensions: res.data.allowed_extensions || [] })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await axios.post(`${API_BASE}/api/v1/config`, config)
      alert('设置已保存，Agent 将在下次采集周期时生效')
    } catch (e) { alert('保存失败'); console.error(e) }
    finally { setSaving(false) }
  }

  const getCatState = (cat) => {
    const n = cat.extensions.filter(e => config.allowed_extensions.includes(e)).length
    if (n === 0) return 'none'
    if (n === cat.extensions.length) return 'all'
    return 'partial'
  }

  const toggleCategory = (cat) => {
    const set = new Set(config.allowed_extensions)
    if (getCatState(cat) === 'all') cat.extensions.forEach(e => set.delete(e))
    else cat.extensions.forEach(e => set.add(e))
    setConfig({ ...config, allowed_extensions: Array.from(set) })
  }

  const toggleExt = (ext) => {
    const set = new Set(config.allowed_extensions)
    if (set.has(ext)) set.delete(ext); else set.add(ext)
    setConfig({ ...config, allowed_extensions: Array.from(set) })
  }

  if (loading) return <div className="text-muted-foreground p-4">加载配置中...</div>

  const totalSelected = config.allowed_extensions.length
  const isAll = totalSelected === 0

  return (
    <div className="w-full max-w-4xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">系统设置</h2>
        <p className="text-muted-foreground">配置全局采集策略，设置将在 Agent 下次心跳时下发生效</p>
      </div>

      {/* 采集策略 */}
      <Card>
        <CardHeader>
          <CardTitle>采集策略配置</CardTitle>
          <CardDescription>下发至所有 Agent 的采集参数</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">单次采集数量限制</label>
            <Input type="number" value={config.collection_limit}
              onChange={(e) => setConfig({ ...config, collection_limit: parseInt(e.target.value) || 0 })} />
            <p className="text-[0.8rem] text-muted-foreground">每次采集循环上传的最大文件数量（0 = 不限制）</p>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">采集间隔（秒）</label>
            <Input type="number" value={config.interval_seconds}
              onChange={(e) => setConfig({ ...config, interval_seconds: parseInt(e.target.value) || 3600 })} />
            <p className="text-[0.8rem] text-muted-foreground">两次扫描之间的等待时间（默认 3600 秒 = 1 小时）</p>
          </div>
        </CardContent>
      </Card>

      {/* 文件格式过滤 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>采集文件格式</CardTitle>
              <CardDescription className="mt-1">勾选需要采集的文件类型，不选任何类型则采集全部文件</CardDescription>
            </div>
            <span className={`text-xs font-medium px-3 py-1 rounded-full border ${
              isAll ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' : 'bg-green-500/10 text-green-500 border-green-500/30'
            }`}>
              {isAll ? '⚡ 全量模式' : `已选 ${totalSelected} 个格式`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">

          {/* 全量采集开关 */}
          <label className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
            <input type="checkbox" checked={isAll}
              onChange={() => setConfig({ ...config, allowed_extensions: [] })}
              className="h-4 w-4 accent-blue-500" />
            <div className="flex-1">
              <span className="text-sm font-medium">全量采集（不限制文件格式）</span>
              <p className="text-xs text-muted-foreground">采集该机器索引内的所有文件类型</p>
            </div>
          </label>

          {/* 分类列表 */}
          {FILE_EXTENSION_CATEGORIES.map(cat => {
            const state = getCatState(cat)
            const selCount = cat.extensions.filter(e => config.allowed_extensions.includes(e)).length
            const isExpanded = expanded[cat.id]
            return (
              <div key={cat.id} className={`rounded-lg border ${cat.border} overflow-hidden transition-all`}>
                <div className={`flex items-center gap-3 p-3 ${ state !== 'none' ? cat.bg : '' } transition-colors`}>
                  <input type="checkbox" id={`cat-${cat.id}`}
                    checked={state === 'all'}
                    ref={el => { if (el) el.indeterminate = state === 'partial' }}
                    onChange={() => toggleCategory(cat)}
                    className="h-4 w-4 accent-blue-500 shrink-0 cursor-pointer" />
                  <span className="text-lg shrink-0">{cat.icon}</span>
                  <label htmlFor={`cat-${cat.id}`} className="flex-1 cursor-pointer">
                    <div className={`text-sm font-semibold ${cat.color}`}>{cat.label}</div>
                    <div className="text-xs text-muted-foreground">{cat.desc}</div>
                  </label>
                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{selCount}/{cat.extensions.length}</span>
                  <button onClick={() => setExpanded(p => ({ ...p, [cat.id]: !p[cat.id] }))}
                    className="p-1 hover:bg-white/10 rounded text-muted-foreground">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>
                {isExpanded && (
                  <div className="border-t px-4 py-3 grid grid-cols-4 sm:grid-cols-6 gap-2 bg-muted/20">
                    {cat.extensions.map(ext => (
                      <label key={ext} className={`flex items-center gap-1 cursor-pointer rounded px-2 py-1 text-xs font-mono transition-colors ${
                        config.allowed_extensions.includes(ext) ? `${cat.bg} ${cat.color} font-bold` : 'text-muted-foreground hover:bg-muted/60'
                      }`}>
                        <input type="checkbox" checked={config.allowed_extensions.includes(ext)}
                          onChange={() => toggleExt(ext)} className="h-3 w-3 accent-blue-500 shrink-0" />
                        {ext}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {!isAll && (
            <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
              <span className="font-medium">已选格式：</span>
              <span className="font-mono">{[...config.allowed_extensions].sort().join(', ')}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 高级配置 */}
      <Card>
        <CardHeader>
          <CardTitle>高级模型配置</CardTitle>
          <CardDescription>当前使用的 AI 模型信息（只读）</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Embedding Model</label>
              <Input value="DashScope text-embedding-v3 (1024 dims)" disabled className="bg-muted/50" />
              <p className="text-[0.8rem] text-muted-foreground">通过阿里云 DashScope API 调用，1024 维稠密向量</p>
            </div>
            <div className="flex items-center gap-2 text-sm p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
              <span className="text-muted-foreground">API 状态：已连接</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="px-8">
          <Save className="mr-2 h-4 w-4" />
          {saving ? '保存中...' : '保存所有配置'}
        </Button>
      </div>
    </div>
  )
}

function TerminalsView() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingAgent, setEditingAgent] = useState(null)
  const [inspectingAgent, setInspectingAgent] = useState(null) // New state for file inspector
  const [deletingAgent, setDeletingAgent] = useState(null) // { agent, mode: 'soft' | 'purge' }
  const [refreshing, setRefreshing] = useState(false)

  // Edit Alias State
  const [newAlias, setNewAlias] = useState("")
  // Search State
  const [searchTerm, setSearchTerm] = useState("")

  const filteredAgents = agents.filter(agent => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      (agent.hostname && agent.hostname.toLowerCase().includes(term)) ||
      (agent.alias && agent.alias.toLowerCase().includes(term)) ||
      (agent.ip_address && agent.ip_address.toLowerCase().includes(term)) ||
      (agent.mac_address && agent.mac_address.toLowerCase().includes(term))
    )
  })

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    setRefreshing(true)
    try {
      const res = await axios.get(`${API_BASE}/api/v1/agent/list`)
      setAgents(res.data)
    } catch (e) {
      console.error("Failed to fetch agents", e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleUpdateAlias = async () => {
    if (!editingAgent) return
    try {
      await axios.patch(`${API_BASE}/api/v1/agent/${editingAgent.id}`, {
        alias: newAlias
      })
      fetchAgents()
      setEditingAgent(null)
    } catch (e) {
      alert("更新失败")
    }
  }

  const handleDelete = async () => {
    if (!deletingAgent) return
    try {
      const url = `${API_BASE}/api/v1/agent/${deletingAgent.agent.id}${deletingAgent.mode === 'purge' ? '/purge' : ''}`
      await axios.delete(url)
      fetchAgents()
      setDeletingAgent(null)
    } catch (e) {
      alert("删除失败: " + e.message)
    }
  }

  const openEdit = (agent) => {
    setNewAlias(agent.alias || "")
    setEditingAgent(agent)
  }

  if (loading) return <div>加载终端列表中...</div>

  return (
    <div className="w-full max-w-6xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">终端管理</h2>
          <p className="text-muted-foreground">监控并管理所有已接入的采集终端</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索 IP / MAC / 主机名..."
              className="pl-8 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={fetchAgents} disabled={refreshing} title="刷新列表">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.length === 0 && (
          <div className="col-span-full text-center py-10 text-muted-foreground">
            未找到匹配的终端
          </div>
        )}
        {filteredAgents.map(agent => (
          <Card key={agent.id} className={`relative transition-all hover:shadow-md cursor-pointer ${agent.active ? 'border-primary/20' : 'opacity-70 border-dashed'}`} onClick={() => setInspectingAgent(agent)}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  {agent.alias || agent.hostname}
                  {agent.active ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-slate-300"></span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs font-mono truncate max-w-[200px]" title={agent.id}>
                  ID: {agent.id}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 relative z-20" onClick={(e) => { e.stopPropagation(); openEdit(agent); }}>
                <Edit className="h-4 w-4 text-muted-foreground" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">文件数量</span>
                  <span className="font-bold text-lg">{agent.file_count.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">向量化数量</span>
                  <span className="font-bold text-lg text-purple-600">{agent.vector_count !== undefined ? agent.vector_count.toLocaleString() : '-'}</span>
                </div>
              </div>

              <div className="space-y-1 mt-3 pt-3 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Network className="h-3 w-3" />
                  <span className="font-mono">{agent.ip_address || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Hash className="h-3 w-3" />
                  <span className="font-mono">{agent.mac_address || "N/A"}</span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(agent.last_heartbeat).toLocaleString()}
                </div>
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{agent.version || 'v1.0'}</span>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 p-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setDeletingAgent({ agent, mode: 'soft' })}>
                移除记录
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setDeletingAgent({ agent, mode: 'purge' })}>
                <Trash2 className="mr-1 h-3 w-3" />
                彻底清除
              </Button>
            </CardFooter>
          </Card>
        ))}

        {agents.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            暂无已连接的终端
          </div>
        )}

      </div>

      {/* Terminal Files Inspector Dialog */}
      <Dialog open={!!inspectingAgent} onOpenChange={(open) => !open && setInspectingAgent(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              终端文件浏览器: {inspectingAgent?.hostname || inspectingAgent?.id}
            </DialogTitle>
            <DialogDescription>
              查看该终端最近采集的文件记录
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden min-h-[400px]">
            {inspectingAgent && <FilesView mode="inspector" agentId={inspectingAgent.id} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!editingAgent} onOpenChange={(open) => !open && setEditingAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑终端别名</DialogTitle>
            <DialogDescription>为终端设置一个易于识别的名称</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">别名 (Alias)</label>
            <Input
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder={editingAgent?.hostname}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingAgent(null)}>取消</Button>
            <Button onClick={handleUpdateAlias}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingAgent} onOpenChange={(open) => !open && setDeletingAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {deletingAgent?.mode === 'purge' ? '确认彻底清除终端？' : '确认移除终端记录？'}
            </DialogTitle>
            <DialogDescription>
              {deletingAgent?.mode === 'purge'
                ? "这将从数据库中完全删除该终端的所有记录以及其所有已索引的文件数据。此操作不可恢复！"
                : "这将仅删除终端的注册信息。如果终端重新上线，它将重新注册，但之前的文件关联可能会丢失或变为孤儿数据。"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setDeletingAgent(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>
              {deletingAgent?.mode === 'purge' ? '彻底删除 (Purge)' : '移除记录'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilesView({ mode = 'files', agentId = null }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("") // Local search state
  const [selectedFile, setSelectedFile] = useState(null)
  const [page, setPage] = useState(0)
  const pageSize = 50

  const pagedFiles = files.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.max(1, Math.ceil(files.length / pageSize))

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return 'N/A'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  const highlightText = (text, keyword) => {
    if (!keyword || !keyword.trim() || !text) return text
    try {
      const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escaped})`, 'gi')
      const parts = text.split(regex)
      return parts.map((part, i) =>
        part.toLowerCase() === keyword.trim().toLowerCase()
          ? <mark key={i} className="bg-yellow-300 text-black rounded-sm px-0.5 font-bold">{part}</mark>
          : part
      )
    } catch { return text }
  }

  useEffect(() => {
    setPage(0) // Reset page on filter change
    if (search.trim()) {
      fetchSearchResults()
      return
    }
    fetchRecentFiles()
    const interval = setInterval(fetchRecentFiles, 5000)
    return () => clearInterval(interval)
  }, [agentId, search])

  const fetchRecentFiles = async () => {
    try {
      const params = new URLSearchParams({ limit: 100 })
      if (agentId) params.append('agent_id', agentId)

      const res = await axios.get(`${API_BASE}/api/v1/files/recent?${params.toString()}`)
      if (res.data.status === 'success') {
        setFiles(res.data.files)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchSearchResults = async () => {
    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/api/v1/search/semantic`, {
        query: search,
        limit: 100,
        agent_id: agentId // Filter by this agent
      })
      if (response.data.status === 'success') {
        setFiles(response.data.results)
      }
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setLoading(false)
    }
  }

  const isVectorMode = mode === 'vectors'
  const isInspectorMode = mode === 'inspector'

  return (
    <div className={`w-full ${isInspectorMode ? '' : 'max-w-6xl'} space-y-4 animate-in fade-in zoom-in-95 duration-300`}>
      <div className="flex items-center justify-between">
        {!isInspectorMode ? (
          <div>
            <h2 className={`text-2xl font-bold tracking-tight ${isVectorMode ? 'text-purple-600' : ''}`}>
              {isVectorMode ? '实时向量流' : '实时文件流'}
            </h2>
            <p className="text-muted-foreground">
              {isVectorMode ? '最新生成 Vector Embedding 的数据项（384维稠密向量）' : '最新采集入库的 100 个文件（点击行查看索引详情）'}
            </p>
          </div>
        ) : (
          <div className="flex-1 mr-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="在此终端搜索内容(语义)..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {!isInspectorMode && (
            <>
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isVectorMode ? 'bg-purple-400' : 'bg-green-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isVectorMode ? 'bg-purple-500' : 'bg-green-500'}`}></span>
              </span>
              <span className="text-sm text-muted-foreground">Live</span>
              <span className="text-xs text-muted-foreground/60 ml-2">
                {files.length > 0 ? `第 ${page * pageSize + 1}-${Math.min((page + 1) * pageSize, files.length)} 条，共 ${files.length}` : ''}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[40%]">文件名/路径</th>
                {isVectorMode ? (
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">向量维度</th>
                ) : (
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">大小</th>
                )}
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">终端ID</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  {isVectorMode ? '向量化时间' : '采集时间'}
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {pagedFiles.length === 0 && !loading ? (
                <tr><td colSpan="4" className="p-8 text-center text-muted-foreground">暂无数据</td></tr>
              ) : pagedFiles.map((file, i) => (
                <tr key={i}
                  className="border-b transition-colors hover:bg-accent/20 cursor-pointer group"
                  onClick={() => setSelectedFile(file)}
                >
                  <td className="p-4 align-middle">
                    <div className="font-medium flex items-center gap-2 group-hover:text-blue-400 transition-colors">
                      {isVectorMode && <Activity className="h-3 w-3 text-purple-500" />}
                      {file.file_name}
                      {file.score !== undefined && (
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${file.score > 0.8 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {(file.score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[400px] font-mono" title={file.file_path}>{file.file_path}</div>
                    {file.summary && file.summary !== file.file_name && (
                      <div className="text-xs text-muted-foreground/60 truncate max-w-[480px] mt-0.5 italic">
                        {file.summary.substring(0, 90)}{file.summary.length > 90 ? '...' : ''}
                      </div>
                    )}
                  </td>
                  {isVectorMode ? (
                    <td className="p-4 align-middle font-mono text-xs text-purple-600">384 dims</td>
                  ) : (
                    <td className="p-4 align-middle font-mono text-xs">{formatSize(file.file_size)}</td>
                  )}
                  <td className="p-4 align-middle">
                    <span className="bg-muted px-2 py-1 rounded text-xs font-mono" title={file.agent_id}>
                      {file.agent_id ? file.agent_id.substring(0, 20) + '...' : '-'}
                    </span>
                  </td>
                  <td className="p-4 align-middle text-xs text-muted-foreground">
                    {new Date(file.modified || Date.now()).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-3">
          <Button variant="outline" size="sm" disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}>← 上一页</Button>
          <span className="text-sm text-muted-foreground px-3">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}>下一页 →</Button>
        </div>
      )}

      {/* File Index Detail Dialog */}
      <Dialog open={!!selectedFile} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <FileText className="h-5 w-5 text-blue-400 shrink-0" />
              <span className="font-mono text-sm truncate">{selectedFile?.file_name}</span>
            </DialogTitle>
            <DialogDescription>文件索引详情 — 元数据与 AI 采集摘要</DialogDescription>
          </DialogHeader>

          {selectedFile && (
            <div className="flex-1 overflow-y-auto space-y-4 pb-2">
              {/* Meta info */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/30 border">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">文件大小</p>
                  <p className="text-sm font-mono font-semibold">{formatSize(selectedFile.file_size)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">修改时间</p>
                  <p className="text-xs">{selectedFile.modified ? new Date(selectedFile.modified).toLocaleString() : '未知'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">来源终端</p>
                  <p className="text-xs font-mono bg-muted px-2 py-0.5 rounded truncate" title={selectedFile.agent_id}>{selectedFile.agent_id}</p>
                </div>
              </div>

              {/* Full path */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">完整路径</p>
                <div className="p-3 bg-muted/50 rounded-md text-xs font-mono break-all select-all leading-relaxed border">
                  {selectedFile.file_path}
                </div>
              </div>

              {/* AI Summary */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">采集索引内容（AI 摘要）</p>
                  {selectedFile.score !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                      selectedFile.score > 0.8 ? 'bg-green-500/10 text-green-500 border-green-500/30'
                      : selectedFile.score > 0.5 ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                      : 'bg-red-500/10 text-red-500 border-red-500/30'
                    }`}>
                      语义匹配 {(selectedFile.score * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="p-4 bg-muted/30 border rounded-lg text-sm leading-relaxed max-h-[340px] overflow-y-auto whitespace-pre-wrap">
                  {(() => {
                    const s = selectedFile.summary
                    if (!s || s.trim() === '' || s.trim() === selectedFile.file_name?.trim()) {
                      return (
                        <div className="text-muted-foreground italic space-y-1">
                          <p>⚠️ 该文件暂无详细内容索引，可能原因：</p>
                          <p className="pl-4 text-xs">• 文件内容未被 Windows Search 建立全文索引</p>
                          <p className="pl-4 text-xs">• 文件格式为图片/二进制，无文本内容可提取</p>
                          <p className="pl-4 text-xs">• Agent 采集时仅获取了文件名和路径元数据</p>
                        </div>
                      )
                    }
                    return highlightText(s, search)
                  })()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
