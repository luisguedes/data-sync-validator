import { useState, useMemo } from 'react';
import { Bell, Check, CheckCheck, Trash2, Volume2, VolumeX, X, AlertCircle, AlertTriangle, Info, CheckCircle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/contexts/NotificationContext';
import { formatDistanceToNow, isAfter, subHours, subDays, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Notification } from '@/hooks/useNotificationCenter';

const typeIcons = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

const typeColors = {
  error: 'text-destructive',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
  success: 'text-green-500',
};

const typeLabels: Record<Notification['type'], string> = {
  error: 'Erro',
  warning: 'Aviso',
  info: 'Info',
  success: 'Sucesso',
};

const periodOptions = [
  { value: 'all', label: 'Todos' },
  { value: '1h', label: 'Última hora' },
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
];

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    soundEnabled,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    toggleSound,
  } = useNotifications();

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      // Filter by type
      if (typeFilter !== 'all' && notification.type !== typeFilter) {
        return false;
      }

      // Filter by period
      if (periodFilter !== 'all') {
        const now = new Date();
        let cutoffDate: Date;

        switch (periodFilter) {
          case '1h':
            cutoffDate = subHours(now, 1);
            break;
          case '24h':
            cutoffDate = subDays(now, 1);
            break;
          case '7d':
            cutoffDate = subWeeks(now, 1);
            break;
          case '30d':
            cutoffDate = subDays(now, 30);
            break;
          default:
            cutoffDate = new Date(0);
        }

        if (!isAfter(notification.createdAt, cutoffDate)) {
          return false;
        }
      }

      return true;
    });
  }, [notifications, typeFilter, periodFilter]);

  const hasActiveFilters = typeFilter !== 'all' || periodFilter !== 'all';

  const clearFilters = () => {
    setTypeFilter('all');
    setPeriodFilter('all');
  };

  const handleNotificationClick = (id: string, actionUrl?: string) => {
    markAsRead(id);
    if (actionUrl) {
      window.location.href = actionUrl;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">Notificações</h4>
            {hasActiveFilters && (
              <span className="text-xs text-muted-foreground">
                ({filteredNotifications.length}/{notifications.length})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={showFilters ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.preventDefault();
                setShowFilters(!showFilters);
              }}
              title="Filtros"
            >
              <Filter className={cn('h-4 w-4', hasActiveFilters && 'text-primary')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.preventDefault();
                toggleSound();
              }}
              title={soundEnabled ? 'Desativar som' : 'Ativar som'}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.preventDefault();
                  markAllAsRead();
                }}
                title="Marcar todas como lidas"
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.preventDefault();
                  clearAll();
                }}
                title="Limpar todas"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="p-3 border-b bg-muted/30 space-y-2">
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="error">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 text-destructive" />
                      Erro
                    </span>
                  </SelectItem>
                  <SelectItem value="warning">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      Aviso
                    </span>
                  </SelectItem>
                  <SelectItem value="info">
                    <span className="flex items-center gap-2">
                      <Info className="h-3 w-3 text-blue-500" />
                      Info
                    </span>
                  </SelectItem>
                  <SelectItem value="success">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Sucesso
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs w-full"
                onClick={clearFilters}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {filteredNotifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {hasActiveFilters ? 'Nenhuma notificação com esses filtros' : 'Nenhuma notificação'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[350px]">
            {filteredNotifications.map((notification) => {
              const Icon = typeIcons[notification.type];
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    'p-3 cursor-pointer flex items-start gap-3 focus:bg-accent',
                    !notification.read && 'bg-accent/50'
                  )}
                  onClick={() => handleNotificationClick(notification.id, notification.actionUrl)}
                >
                  <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', typeColors[notification.type])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-tight">
                        {notification.title}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {!notification.read && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.description}
                    </p>
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      {formatDistanceToNow(notification.createdAt, {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
