import '@/app/globals.css';
import { AnimationProvider } from '@/components/animation-provider.jsx';

export const metadata = {
  title: 'Acts House Cup | Team Scoreboard',
  description: 'Live team scores and the final event reward reveal.',
  applicationName: 'Acts House Cup',
};

export const viewport = { themeColor: '#080d17' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AnimationProvider>{children}</AnimationProvider>
      </body>
    </html>
  );
}
