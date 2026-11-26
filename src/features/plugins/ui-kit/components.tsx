import { Children, cloneElement, forwardRef, isValidElement, useId } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  PluginBadgeProps,
  PluginButtonProps,
  PluginCardProps,
  PluginCheckboxProps,
  PluginFieldProps,
  PluginInputProps,
  PluginLabelProps,
  PluginSelectProps,
  PluginSeparatorProps,
  PluginStackProps,
  PluginSwitchProps,
  PluginTabsProps,
  PluginTextareaProps,
  PluginTooltipProps,
} from "../plugin.types";

/**
 * The plugin UI kit (API 1.18): the host's shadcn components behind small, stable props.
 *
 * Plugins never see the shadcn/Radix props, so regenerating a component with the CLI cannot
 * break a plugin; compound components (Select, Tabs, Card, Tooltip) take data instead of parts.
 * Every component accepts `className` / `style` for layout. See `plugins/README.md`.
 */

export const KitButton = forwardRef<HTMLButtonElement, PluginButtonProps>((props, ref) => (
  <Button ref={ref} {...props} />
));
KitButton.displayName = "StructuraButton";

export const KitInput = forwardRef<HTMLInputElement, PluginInputProps>((props, ref) => (
  <Input ref={ref} {...props} />
));
KitInput.displayName = "StructuraInput";

export const KitTextarea = forwardRef<HTMLTextAreaElement, PluginTextareaProps>((props, ref) => (
  <Textarea ref={ref} {...props} />
));
KitTextarea.displayName = "StructuraTextarea";

export function KitLabel(props: PluginLabelProps) {
  return <Label {...props} />;
}

export function KitField({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  style,
}: PluginFieldProps) {
  const fallbackId = useId();
  const id = htmlFor ?? fallbackId;
  const messageId = `${id}-message`;
  const message = error ?? hint;
  // The label points at the control; a single child element without an id gets this one.
  const only = Children.count(children) === 1 ? Children.only(children) : null;
  const control =
    !htmlFor && isValidElement<{ id?: string; "aria-describedby"?: string }>(only) && !only.props.id
      ? cloneElement(only, { id, ...(message ? { "aria-describedby": messageId } : {}) })
      : children;
  return (
    <div className={cn("flex flex-col gap-1.5", className)} style={style}>
      <Label htmlFor={id}>{label}</Label>
      {control}
      {message ? (
        <p
          id={messageId}
          className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function KitCheckbox(props: PluginCheckboxProps) {
  const { onCheckedChange, ...rest } = props;
  return <Checkbox {...rest} onCheckedChange={(state) => onCheckedChange?.(state === true)} />;
}

export function KitSwitch(props: PluginSwitchProps) {
  return <Switch {...props} />;
}

export function KitSelect({
  id,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  disabled,
  className,
  style,
  "aria-label": ariaLabel,
}: PluginSelectProps) {
  const { t } = useTranslation();
  return (
    <Select
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} style={style} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder ?? t("common.selectPlaceholder")} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function KitBadge(props: PluginBadgeProps) {
  return <Badge {...props} />;
}

export function KitCard({
  title,
  description,
  footer,
  children,
  className,
  style,
}: PluginCardProps) {
  return (
    <Card className={className} style={style}>
      {title || description ? (
        <CardHeader>
          {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
          {/* A div, not CardDescription's <p>: the kit takes any ReactNode here, blocks included. */}
          {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
        </CardHeader>
      ) : null}
      {children ? (
        <CardContent className={title || description ? undefined : "pt-6"}>{children}</CardContent>
      ) : null}
      {footer ? <CardFooter className="justify-end gap-2">{footer}</CardFooter> : null}
    </Card>
  );
}

export function KitTabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
  className,
  style,
}: PluginTabsProps) {
  return (
    <Tabs
      value={value}
      defaultValue={value === undefined ? (defaultValue ?? tabs[0]?.value) : undefined}
      onValueChange={onValueChange}
      className={className}
      style={style}
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} disabled={tab.disabled}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function KitTooltip({ content, side, children }: PluginTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </Tooltip>
  );
}

export function KitSeparator({
  orientation = "horizontal",
  className,
  style,
}: PluginSeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      style={style}
    />
  );
}

const ALIGN = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" };
const JUSTIFY = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
};

export function KitStack({
  direction = "column",
  gap = 2,
  align,
  justify,
  wrap,
  children,
  className,
  style,
}: PluginStackProps) {
  // Inline styles, not utility classes: the host's CSS holds only the classes its own source
  // uses, so a `gap-6` the host never writes would not exist.
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: direction,
        gap: gap * 4,
        ...(align ? { alignItems: ALIGN[align] } : {}),
        ...(justify ? { justifyContent: JUSTIFY[justify] } : {}),
        ...(wrap ? { flexWrap: "wrap" as const } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
