# Theme System

## Overview

The theme system provides dark/light mode support with persistent user preferences across sessions. It integrates with Tailwind CSS for consistent styling throughout the application.

## Technical Implementation

### Core Technologies

- **React Context API**: Global theme state management
- **Tailwind CSS**: Dark mode styling utilities
- **localStorage**: Theme persistence
- **TanStack Start**: Server-side theme handling

### Architecture

#### Theme Provider

**Location**: [src/components/theme-provider.tsx](../src/components/theme-provider.tsx)

**Functionality**:

- Wraps entire application
- Manages theme state (light/dark/system)
- Persists theme preference to localStorage
- Syncs theme with system preferences (when in system mode)
- Provides theme context to all components

**Theme States**:

- `light`: Light mode
- `dark`: Dark mode
- `system`: Follows OS preference

**Context API**:

```typescript
ThemeProviderContext {
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme) => void
}
```

#### Theme Toggle Component

**Location**: [src/components/theme-toggle.tsx](../src/components/theme-toggle.tsx)

**Features**:

- Button to cycle through themes
- Icons indicating current theme (Sun/Moon/Monitor)
- Dropdown menu for theme selection
- Keyboard accessible
- Tooltip support

### Server Functions

**Location**: [src/lib/server/theme.ts](../src/lib/server/theme.ts)

#### Functions

1. **`getUserTheme(userId)`**: Fetches user's saved theme preference
   - Returns theme from database
   - Used for SSR initialization

2. **`setUserTheme(userId, theme)`**: Saves theme preference
   - Updates user record in database
   - Provides cross-device synchronization

### Database Integration

User theme preferences can be stored in the database for cross-device sync:

```typescript
// Add to users table schema
users {
  ...
  theme: varchar ('light' | 'dark' | 'system')
}
```

### Tailwind Configuration

**Location**: `tailwind.config.ts`

**Dark Mode Strategy**: `class`

This enables dark mode by adding `dark` class to the `html` element:

```typescript
module.exports = {
  darkMode: "class",
  // ...
};
```

**Dark Mode Utilities**:

```css
/* Light mode (default) */
.bg-background {
  background: white;
}

/* Dark mode */
.dark .bg-background {
  background: black;
}
```

### CSS Variables

Theme uses CSS custom properties for dynamic theming:

**Location**: [src/styles.css](../src/styles.css)

**Light Mode Variables**:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... more variables */
}
```

**Dark Mode Variables**:

```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  /* ... more variables */
}
```

### Implementation Details

#### Theme Detection

**System Preference Detection**:

```typescript
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";
```

**Change Listener**:

```typescript
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (e) => {
    if (theme === "system") {
      applyTheme(e.matches ? "dark" : "light");
    }
  });
```

#### Theme Application

**DOM Manipulation**:

```typescript
const applyTheme = (theme: "light" | "dark") => {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
};
```

#### LocalStorage Persistence

**Save Theme**:

```typescript
localStorage.setItem("theme", theme);
```

**Load Theme**:

```typescript
const savedTheme = localStorage.getItem("theme") || "system";
```

### Integration Points

#### Router Integration

**Location**: [src/router.tsx](../src/router.tsx)

Theme provider wraps the router:

```typescript
<ThemeProvider>
  <RouterProvider router={router} />
</ThemeProvider>
```

#### Component Usage

Any component can access theme:

```typescript
import { useTheme } from '@/components/theme-provider'

function MyComponent() {
  const { theme, setTheme } = useTheme()

  return (
    <button onClick={() => setTheme('dark')}>
      Current theme: {theme}
    </button>
  )
}
```

#### UI Components

All shadcn/ui components support dark mode automatically through CSS variables:

- Buttons
- Cards
- Inputs
- Dialogs
- etc.

### User Experience

#### Theme Toggle Placement

- **Desktop**: In header/navigation bar
- **Mobile**: In sidebar menu
- **User Menu**: Accessible from user dropdown

#### Visual Feedback

- Smooth transitions between themes
- Icons change based on current theme
- Theme persists across navigation
- No flash of unstyled content (FOUC)

#### Accessibility

- High contrast ratios in both modes
- WCAG AA compliant colors
- Keyboard navigation support
- Screen reader announcements

## Features

### Automatic System Sync

When theme set to "system":

- Follows OS light/dark mode preference
- Updates automatically when OS preference changes
- Respects user's system-wide choice

### Persistent Preferences

- Theme saved to localStorage
- Restored on page reload
- Optionally synced to database for cross-device

### Smooth Transitions

CSS transitions on theme changes:

```css
* {
  transition:
    background-color 0.3s ease,
    color 0.3s ease;
}
```

### No Flash of Unstyled Content

Theme applied before first render:

- Script in HTML head
- Checks localStorage immediately
- Applies theme class before React hydration

## Data Flow

### Initial Load

1. Page loads
2. Inline script checks localStorage for saved theme
3. Applies theme class to `<html>` element
4. React hydrates
5. ThemeProvider initializes with current theme
6. No theme flash visible to user

### Theme Change by User

1. User clicks theme toggle
2. Calls `setTheme('dark')` from context
3. Context updates state
4. Effect applies 'dark' class to DOM
5. Saves 'dark' to localStorage
6. All components re-render with new theme

### System Theme Change

1. OS theme changes (e.g., sunset triggers dark mode)
2. `matchMedia` listener fires
3. If user theme is 'system', applies new theme
4. DOM updates with appropriate class
5. Components reflect new theme

## Security & Privacy

1. **localStorage Only**: Theme preference stored client-side
2. **No Tracking**: Theme changes not tracked/logged
3. **User Control**: User can change theme anytime
4. **No External Requests**: Theme handled entirely client-side

## Performance Optimizations

1. **CSS Variables**: Single source of truth for colors
2. **Class-Based**: Fast DOM class manipulation
3. **No JavaScript Flicker**: Theme applied before JS execution
4. **Memoized Context**: Theme context memoized to prevent unnecessary renders
5. **Efficient Transitions**: CSS transitions hardware-accelerated

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Full support
- IE11: Fallback to light mode (no CSS variable support)

## Customization

### Adding New Theme

1. Define CSS variables in `styles.css`
2. Add theme option to ThemeProvider
3. Update theme toggle to include new option
4. Add theme colors to Tailwind config

### Custom Color Schemes

Modify CSS variables:

```css
.dark {
  --primary: 250 100% 60%; /* Custom purple */
  --background: 240 10% 10%; /* Custom dark bg */
}
```

### Per-Component Theming

Components can have unique dark mode styles:

```css
.my-component {
  background: var(--background);
}

.dark .my-component {
  background: linear-gradient(to bottom, #1a1a1a, #0a0a0a);
}
```

## Future Enhancements

- Multiple color schemes (not just light/dark)
- Party-themed colors (based on user's party)
- Custom theme builder
- Scheduled theme changes (auto dark mode at night)
- High contrast mode
- Colorblind-friendly themes
- Theme presets (solarized, dracula, etc.)
- Per-page theme overrides
- Theme import/export
