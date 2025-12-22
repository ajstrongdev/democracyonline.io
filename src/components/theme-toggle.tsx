import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { SidebarMenuButton } from '@/components/ui/sidebar'

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  function toggleTheme() {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <SidebarMenuButton onClick={toggleTheme}>
      {theme === 'dark' ? <Moon /> : <Sun />}
      <span>Change theme</span>
    </SidebarMenuButton>
  )
}
