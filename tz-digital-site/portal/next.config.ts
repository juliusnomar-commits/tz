import type { NextConfig } from 'next'

const config: NextConfig = {
  agentRules: false,
  async rewrites() {
    return [{ source: '/', destination: '/index.html' }]
  },
}

export default config
