import { motion } from 'framer-motion'
import { ExternalLink, HeartHandshake, MessageCircleMore, Sparkles } from 'lucide-react'

import heroImage from '../assets/hero.png'

const repoUrl = 'https://github.com/myxsf/PortMaster'

export function HomePage() {
  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="overflow-hidden rounded-[28px] border border-[#1c2933] bg-[radial-gradient(circle_at_top_left,rgba(36,150,237,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_24%),linear-gradient(135deg,#121a23,#0b1117)] shadow-[0_20px_60px_rgba(0,0,0,0.26)]"
      >
        <div className="grid gap-6 p-8 lg:grid-cols-[minmax(0,1.1fr)_320px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#25405a] bg-[#122130] px-4 py-2 text-xs uppercase tracking-[0.24em] text-[#8fcfff]">
              <Sparkles className="h-3.5 w-3.5" />
              PortMaster
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">
              把本地项目启动、端口管理、Docker 容器和日志排查放到一个桌面面板里
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
              常用项目可以直接保存启动命令，第一次是手动启动的服务也可以补录下来。以后不需要反复翻终端命令，直接在 PortMaster 里启动、关闭和查看日志就行。
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#2a333d] bg-[#121a23] px-5 py-4 text-sm text-slate-100 transition hover:border-[#2496ED]/40 hover:bg-[#16222e]"
              >
                <ExternalLink className="h-4 w-4" />
                GitHub 仓库
              </a>
              <button
                type="button"
                onClick={() => window.alert('讨论 Q 群入口稍后补充，按钮位已预留。')}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#25405a] bg-[#122130] px-5 py-4 text-sm text-[#8fcfff] transition hover:border-[#2496ED]/40 hover:bg-[#17304a]"
              >
                <MessageCircleMore className="h-4 w-4" />
                讨论 Q 群
              </button>
              <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#1f6f47] bg-[#133121] px-5 py-4 text-sm text-[#9bf3be]">
                <HeartHandshake className="h-4 w-4" />
                支持与反馈
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-[#22303d] bg-[#0d1319] p-4">
            <img
              src={heroImage}
              alt="PortMaster hero"
              className="h-full w-full rounded-[18px] object-cover"
            />
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          {
            title: '仓库地址',
            body: repoUrl,
          },
          {
            title: '讨论 Q 群',
            body: '按钮已预留，群链接后续可直接替换到首页。',
          },
          {
            title: '你能得到什么',
            body: '更清楚的项目分组、更稳定的启动关闭，以及更直接的日志排查入口。',
          },
        ].map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 * index, ease: 'easeOut' }}
            className="rounded-[24px] border border-[#1c2933] bg-[#0d1319] p-5"
          >
            <div className="text-xs uppercase tracking-[0.24em] text-[#7CC6FF]">{item.title}</div>
            <div className="mt-4 break-all text-lg font-medium text-white">{item.body}</div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
