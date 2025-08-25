import { createTheme } from '@mantine/core';

export const theme = createTheme({
  /** Primary brand colors */
  primaryColor: 'blue',
  
  /** Font configuration */
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  fontFamilyMonospace: 'Monaco, Courier, monospace',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '2.125rem', lineHeight: '1.2' },
      h2: { fontSize: '1.625rem', lineHeight: '1.25' },
      h3: { fontSize: '1.375rem', lineHeight: '1.3' },
      h4: { fontSize: '1.125rem', lineHeight: '1.4' },
      h5: { fontSize: '1rem', lineHeight: '1.5' },
      h6: { fontSize: '0.875rem', lineHeight: '1.5' },
    },
  },

  /** Spacing and sizing */
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },

  /** Border radius */
  radius: {
    xs: '0.25rem',
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
  },

  /** Shadow configuration */
  shadows: {
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },

  /** Custom colors for dark theme */
  colors: {
    // Deep emerald green primary
    emerald: [
      '#ecfdf5', // lightest
      '#d1fae5',
      '#a7f3d0',
      '#6ee7b7',
      '#34d399',
      '#10b981',
      '#059669',
      '#047857', 
      '#0F4C3A', // Your specified deep emerald
      '#006B3C', // Your specified deep emerald (darker)
    ],
    // Muted gold accent
    gold: [
      '#fefce8',
      '#fef9c3',
      '#fef08a',
      '#fde047',
      '#facc15',
      '#eab308',
      '#ca8a04',
      '#D4AF37', // Classic gold
      '#C5A46D', // Your specified muted gold
      '#B8860B', // Darker gold
    ],
    // Dark backgrounds and surfaces
    dark: [
      '#F5F5F5', // off-white text
      '#E5E5E5', // lighter text
      '#CCCCCC', // muted text
      '#999999', // dimmed text
      '#666666', // very dimmed
      '#404040', // surface elements
      '#2A2A2A', // elevated surfaces
      '#1A1A1A', // Your specified background
      '#0D0D0D', // Your specified background (darker)
      '#000000', // pure black
    ],
    // Professional grays for dark theme
    gray: [
      '#F5F5F5', // off-white
      '#E5E5E5',
      '#CCCCCC', 
      '#999999',
      '#666666',
      '#4A4A4A',
      '#333333',
      '#2A2A2A',
      '#1A1A1A',
      '#0D0D0D',
    ],
  },

  /** Component overrides for professional appearance */
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 500,
          transition: 'all 150ms ease',
        },
      },
    },
    
    Card: {
      defaultProps: {
        radius: 'lg',
        shadow: 'sm',
        withBorder: true,
      },
    },

    Paper: {
      defaultProps: {
        radius: 'md',
        shadow: 'xs',
      },
    },

    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },

    Select: {
      defaultProps: {
        radius: 'md',
      },
    },

    Badge: {
      defaultProps: {
        radius: 'sm',
      },
    },

    Table: {
      defaultProps: {
        striped: true,
        highlightOnHover: true,
      },
    },

    Modal: {
      defaultProps: {
        radius: 'lg',
        shadow: 'xl',
      },
    },

    Tabs: {
      defaultProps: {
        radius: 'md',
      },
    },
  },

});