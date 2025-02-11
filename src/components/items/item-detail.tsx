import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link2 } from "lucide-react";
import type { ListItem } from "@/types/list";
import { ErrorBoundaryWrapper } from "@/components/error-boundary-wrapper";
import { wrapUrlsInAnchors } from "@/lib/utils";

interface ItemDetailProps {
  item: ListItem;
  rank: number;
}

export function ItemDetail({ item, rank }: ItemDetailProps) {
  return (
    <ErrorBoundaryWrapper>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 
                className="font-semibold leading-none tracking-tight"
                dangerouslySetInnerHTML={{ __html: `${rank}. ${wrapUrlsInAnchors(item.title)}` }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {item.comment && (
            <div>
              <h4 className="font-medium mb-1">Comment</h4>
              <p 
                className="text-sm text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: wrapUrlsInAnchors(item.comment) }}
              />
            </div>
          )}

          {item.properties && item.properties.length > 0 && (
            <div className="space-y-4">
              {item.properties.map(prop => (
                <div key={prop.id}>
                  <h4 className="font-medium mb-1">{prop.tag || 'Property'}</h4>
                  {prop.type === 'link' ? (
                    <a 
                      href={prop.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:underline break-all inline-flex items-center gap-1"
                    >
                      {prop.value}
                      <Link2 className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">{prop.value}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </ErrorBoundaryWrapper>
  );
} 