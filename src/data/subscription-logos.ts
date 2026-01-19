export interface SubscriptionLogoOption {
  id: string
  nome: string
  categoria: 'streaming' | 'musica' | 'produtividade' | 'nuvem' | 'outros'
  logoUrl: string // Emoji ou URL futura
  cor: string
}

export const SUBSCRIPTION_LOGOS: SubscriptionLogoOption[] = [
  // Streaming de Vídeo
  { id: 'netflix', nome: 'Netflix', categoria: 'streaming', logoUrl: '🎬', cor: '#E50914' },
  { id: 'prime-video', nome: 'Prime Video', categoria: 'streaming', logoUrl: '📺', cor: '#00A8E1' },
  { id: 'disney-plus', nome: 'Disney+', categoria: 'streaming', logoUrl: '🎭', cor: '#113CCF' },
  { id: 'hbo-max', nome: 'HBO Max', categoria: 'streaming', logoUrl: '🎥', cor: '#B100FF' },
  { id: 'star-plus', nome: 'Star+', categoria: 'streaming', logoUrl: '⭐', cor: '#FFD500' },
  { id: 'globoplay', nome: 'Globoplay', categoria: 'streaming', logoUrl: '🌐', cor: '#FF6B00' },
  { id: 'paramount-plus', nome: 'Paramount+', categoria: 'streaming', logoUrl: '🎪', cor: '#0064FF' },

  // Música
  { id: 'spotify', nome: 'Spotify', categoria: 'musica', logoUrl: '🎵', cor: '#1DB954' },
  { id: 'apple-music', nome: 'Apple Music', categoria: 'musica', logoUrl: '🎶', cor: '#FA243C' },
  { id: 'youtube-music', nome: 'YouTube Music', categoria: 'musica', logoUrl: '🎧', cor: '#FF0000' },
  { id: 'deezer', nome: 'Deezer', categoria: 'musica', logoUrl: '🎼', cor: '#FEAA2D' },
  { id: 'amazon-music', nome: 'Amazon Music', categoria: 'musica', logoUrl: '🎸', cor: '#FF9900' },

  // Produtividade
  { id: 'office-365', nome: 'Microsoft 365', categoria: 'produtividade', logoUrl: '💼', cor: '#D83B01' },
  { id: 'adobe-creative', nome: 'Adobe Creative Cloud', categoria: 'produtividade', logoUrl: '🎨', cor: '#FF0000' },
  { id: 'canva-pro', nome: 'Canva Pro', categoria: 'produtividade', logoUrl: '✨', cor: '#00C4CC' },
  { id: 'notion', nome: 'Notion', categoria: 'produtividade', logoUrl: '📝', cor: '#000000' },

  // Nuvem e Armazenamento
  { id: 'icloud', nome: 'iCloud', categoria: 'nuvem', logoUrl: '☁️', cor: '#3B99FC' },
  { id: 'google-one', nome: 'Google One', categoria: 'nuvem', logoUrl: '📦', cor: '#4285F4' },
  { id: 'dropbox', nome: 'Dropbox', categoria: 'nuvem', logoUrl: '📂', cor: '#0061FF' },
  { id: 'onedrive', nome: 'OneDrive', categoria: 'nuvem', logoUrl: '💾', cor: '#0078D4' },

  // Outros
  { id: 'youtube-premium', nome: 'YouTube Premium', categoria: 'outros', logoUrl: '▶️', cor: '#FF0000' },
  { id: 'amazon-prime', nome: 'Amazon Prime', categoria: 'outros', logoUrl: '📦', cor: '#FF9900' },
  { id: 'xbox-game-pass', nome: 'Xbox Game Pass', categoria: 'outros', logoUrl: '🎮', cor: '#107C10' },
  { id: 'playstation-plus', nome: 'PlayStation Plus', categoria: 'outros', logoUrl: '🎮', cor: '#003087' },
  { id: 'linkedin-premium', nome: 'LinkedIn Premium', categoria: 'outros', logoUrl: '💼', cor: '#0A66C2' },
  { id: 'duolingo-plus', nome: 'Duolingo Plus', categoria: 'outros', logoUrl: '🦉', cor: '#58CC02' },
  { id: 'github-copilot', nome: 'GitHub Copilot', categoria: 'produtividade', logoUrl: '🤖', cor: '#000000' },
  { id: 'chatgpt-plus', nome: 'ChatGPT Plus', categoria: 'produtividade', logoUrl: '🤖', cor: '#10A37F' },
  { id: 'other', nome: 'Outro', categoria: 'outros', logoUrl: '📱', cor: '#6B7280' },
]

export function getLogoById(id: string): SubscriptionLogoOption | undefined {
  return SUBSCRIPTION_LOGOS.find((logo) => logo.id === id)
}

export function getLogosByCategory(categoria: SubscriptionLogoOption['categoria']): SubscriptionLogoOption[] {
  return SUBSCRIPTION_LOGOS.filter((logo) => logo.categoria === categoria)
}
