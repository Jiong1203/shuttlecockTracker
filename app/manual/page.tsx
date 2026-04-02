import fs from "fs"
import path from "path"
import ReactMarkdown from "react-markdown"
import { BookOpen } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata = {
  title: "使用手冊 | 羽球庫存共享小幫手",
}

export default async function ManualPage() {
  const filePath = path.join(process.cwd(), "docs", "user-manual.md")
  const content = fs.readFileSync(filePath, "utf-8")

  const sections = content.split(/^## /m)
  
  const blocks = sections.map((sec, i) => {
    // Remove trailing horizontal rules that separated sections in the original markdown
    const cleanContent = sec.replace(/\n\s*---\s*$/, '').trim()

    if (i === 0) {
      return { id: 'intro', title: '簡介', content: cleanContent }
    }
    
    const firstLineEnd = cleanContent.indexOf('\n')
    const title = cleanContent.substring(0, firstLineEnd !== -1 ? firstLineEnd : cleanContent.length).trim()
    
    return {
      id: title,
      title,
      content: "## " + cleanContent
    }
  }).filter(b => b.content)

  const filteredBlocks = blocks.filter(b => b.title !== "目錄")

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 flex flex-col md:flex-row gap-6 items-start">
        {/* Left Sidebar TOC */}
        <div className="md:w-64 shrink-0 md:sticky md:top-8 bg-background border rounded-xl shadow-sm p-5 w-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <BookOpen className="w-5 h-5 text-blue-500" />
              <span className="text-lg">目錄</span>
            </div>
            <ThemeToggle />
          </div>
          <nav className="space-y-1.5">
            {filteredBlocks.map(block => (
              <a
                key={block.id}
                href={`#${block.id}`}
                className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted font-medium rounded-lg transition-colors"
              >
                {block.title}
              </a>
            ))}
          </nav>
        </div>

        {/* Right Content Cards */}
        <div className="flex-1 w-full space-y-6">
          {filteredBlocks.map(block => (
            <div
              key={block.id}
              id={block.id}
              className="scroll-mt-8 bg-background border rounded-2xl shadow-sm p-6 md:p-10"
            >
              <div className="prose prose-sm md:prose-base max-w-none
                text-foreground
                prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground
                prose-h1:text-2xl prose-h1:mb-6 prose-h1:pb-4 prose-h1:border-b prose-h1:border-border
                prose-h2:text-xl prose-h2:mt-2 prose-h2:mb-4 prose-h2:text-foreground
                prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-foreground
                prose-p:leading-relaxed prose-p:my-3 prose-p:text-foreground/90
                prose-li:my-1 prose-li:leading-relaxed prose-li:text-foreground/90
                prose-strong:text-foreground prose-strong:font-semibold
                prose-table:text-sm prose-th:text-left prose-th:font-semibold prose-th:text-foreground prose-td:text-foreground/90
                prose-code:text-sm prose-code:bg-muted prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:border prose-code:border-border
                prose-pre:bg-muted prose-pre:text-foreground prose-pre:text-sm prose-pre:p-4 prose-pre:rounded-xl prose-pre:border prose-pre:border-border
                prose-blockquote:text-muted-foreground prose-blockquote:border-l-4 prose-blockquote:border-blue-500/50 prose-blockquote:bg-muted/40 prose-blockquote:pl-4 prose-blockquote:py-2.5 prose-blockquote:rounded-r-lg prose-blockquote:text-sm prose-blockquote:not-italic
                prose-a:text-blue-500 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                prose-hr:border-border/60 prose-hr:my-6
                prose-ul:pl-6 prose-ol:pl-6">
                <ReactMarkdown>
                  {block.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
