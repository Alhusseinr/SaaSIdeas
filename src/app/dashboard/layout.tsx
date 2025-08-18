'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AppShell,
  Button,
  Stack,
  Group,
  Text,
  Avatar,
  Menu,
  ActionIcon,
  Burger
} from '@mantine/core'
import {
  IconDashboard,
  IconBrain,
  IconTable,
  IconSettings,
  IconTrendingUp,
  IconUsers,
  IconLogout,
  IconUser,
  IconChevronDown
} from '@tabler/icons-react'
import { useAuth } from '@/hooks/useAuth'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const [navbarOpened, setNavbarOpened] = useState(false)

  const navigationItems = [
    { icon: IconDashboard, label: 'Strategic Overview', href: '/dashboard/overview' },
    { icon: IconBrain, label: 'Opportunity Validator', href: '/dashboard/validator' },
    { icon: IconTable, label: 'Market Intelligence', href: '/dashboard/market-intelligence' },
    { icon: IconSettings, label: 'System Operations', href: '/dashboard/operations' },
    { icon: IconTrendingUp, label: 'Edge Functions', href: '/dashboard/edge-functions' },
    { icon: IconUsers, label: 'Subscription Management', href: '/dashboard/subscription' }
  ]

  return (
    <AppShell
      header={{ height: 70 }}
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !navbarOpened },
      }}
      padding="md"
      style={{ backgroundColor: '#0D0D0D' }}
    >
      <AppShell.Header style={{ backgroundColor: '#1A1A1A', borderBottom: '1px solid #404040' }}>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={navbarOpened}
              onClick={() => setNavbarOpened(!navbarOpened)}
              hiddenFrom="sm"
              size="sm"
              style={{ color: '#F5F5F5' }}
            />
            <Text size="xl" fw={700} c="#F5F5F5">
              SaaS Intelligence Platform
            </Text>
          </Group>
          
          {user && (
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button
                  variant="subtle"
                  rightSection={<IconChevronDown size={14} />}
                  leftSection={
                    <Avatar size="sm" color="emerald">
                      <IconUser size={16} />
                    </Avatar>
                  }
                  style={{ color: '#F5F5F5' }}
                >
                  {user.email?.split('@')[0]}
                </Button>
              </Menu.Target>

              <Menu.Dropdown style={{ backgroundColor: '#2A2A2A', borderColor: '#404040' }}>
                <Menu.Item
                  leftSection={<IconLogout size={14} />}
                  onClick={signOut}
                  style={{ color: '#F5F5F5' }}
                >
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" style={{ backgroundColor: '#1A1A1A', borderRight: '1px solid #404040' }}>
        <Stack gap="xs">
          {navigationItems.map((item) => (
            <Button
              key={item.href}
              component={Link}
              href={item.href}
              variant="subtle"
              size="md"
              style={{
                color: pathname === item.href ? '#C5A46D' : '#E5E5E5',
                backgroundColor: pathname === item.href ? '#2A2A2A' : 'transparent',
                border: 'none',
                borderLeft: pathname === item.href ? '3px solid #C5A46D' : '3px solid transparent'
              }}
              justify="flex-start"
              leftSection={<item.icon size={18} />}
              fullWidth
            >
              {item.label}
            </Button>
          ))}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  )
}