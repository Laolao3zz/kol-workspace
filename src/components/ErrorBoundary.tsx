import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-canvas-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-soft border border-canvas-200 p-8 max-w-md mx-4 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">页面出现异常</h2>
            <p className="text-sm text-gray-500 mb-4">
              {this.state.error?.message || '未知错误'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-sage-600 text-white text-sm rounded-lg hover:bg-sage-700"
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
