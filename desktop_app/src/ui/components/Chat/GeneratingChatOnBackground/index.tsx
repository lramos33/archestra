import { Loader2, RefreshCcw } from 'lucide-react';

import { Button } from '@ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/components/ui/card';

export function GeneratingChatOnBackground() {
  return (
    <Card className="w-full max-w-md mx-auto text-center rounded-2xl shadow-md border border-muted">
      <CardHeader>
        <div className="flex justify-center mb-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <CardTitle className="text-lg font-semibold">Generating your chat...</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Please wait a moment while we prepare everything in the background.
        </p>

        <Button variant="outline" className="flex items-center gap-2 mx-auto" onClick={() => window.location.reload()}>
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
}
