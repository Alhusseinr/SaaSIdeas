'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconDashboard,
  IconBrain,
  IconTable,
  IconSettings,
  IconTrendingUp,
  IconUsers,
  IconLogout,
  IconUser,
  IconChevronDown,
  IconMenu2,
  IconX
} from '@tabler/icons-react'
import { useAuth } from '@/hooks/useAuth'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const navigationItems = [
    { icon: IconDashboard, label: 'Strategic Overview', href: '/dashboard/overview' },
    { icon: IconBrain, label: 'Opportunity Validator', href: '/dashboard/validator' },
    { icon: IconTable, label: 'Market Intelligence', href: '/dashboard/market-intelligence' },
    { icon: IconSettings, label: 'System Operations', href: '/dashboard/operations' },
    { icon: IconTrendingUp, label: 'Edge Functions', href: '/dashboard/edge-functions' },
    { icon: IconUsers, label: 'Subscription Management', href: '/dashboard/subscription' }
  ]

  return (
    <div className="flex min-h-screen bg-white">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 shadow-sm transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            SaaS Intelligence
          </h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-600 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100"
          >
            <IconX size={20} />
          </button>
        </div>
        
        <nav className="mt-6 px-4">
          <h2 className="text-xs text-gray-500 uppercase font-bold mb-4 tracking-wide px-3">
            Navigation
          </h2>
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-green-50 to-blue-50 text-green-700 shadow-sm border-l-4 border-green-500 transform scale-[1.02]'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 hover:transform hover:scale-[1.01]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon size={18} className="mr-3" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        {/* Top header */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-600 hover:text-gray-900 lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <IconMenu2 size={20} />
            </button>
            
            <div className="flex items-center space-x-4 ml-auto">
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                      <IconUser size={16} className="text-white" />
                    </div>
                    <span className="text-sm font-medium hidden sm:block">
                      {user.email?.split('@')[0]}
                    </span>
                    <IconChevronDown size={14} />
                  </button>

                  {/* User dropdown menu */}
                  {userMenuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-10"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-2">
                        <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                          {user.email}
                        </div>
                        <button
                          onClick={() => {
                            signOut()
                            setUserMenuOpen(false)
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <IconLogout size={16} className="mr-2" />
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}