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
    <div className="min-h-screen bg-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-gray-800 border-r border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-700">
          <h1 className="text-xl font-bold text-white">SaaS Intelligence</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <IconX size={20} />
          </button>
        </div>
        
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gray-700 text-yellow-400 border-l-4 border-yellow-400'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
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
      <div className="lg:pl-72">
        {/* Top header */}
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="flex items-center justify-between h-16 px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-400 hover:text-white lg:hidden"
            >
              <IconMenu2 size={20} />
            </button>
            
            <div className="flex items-center space-x-4">
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-2 text-gray-300 hover:text-white bg-gray-700 px-3 py-2 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
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
                      <div className="absolute right-0 mt-2 w-48 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-20">
                        <button
                          onClick={() => {
                            signOut()
                            setUserMenuOpen(false)
                          }}
                          className="flex items-center w-full px-4 py-3 text-sm text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
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
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}