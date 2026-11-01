import Link from 'next/link'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, Page, PageHeader } from '@/ui'

const COLORS = [
  ['bg-background', 'Background'],
  ['bg-foreground', 'Foreground'],
  ['bg-primary', 'Primary'],
  ['bg-secondary', 'Secondary'],
  ['bg-muted', 'Muted'],
  ['bg-accent', 'Accent'],
  ['bg-destructive', 'Destructive'],
  ['bg-success', 'Success'],
] as const

// The shadcn components the app uses, with their variants, in the current
// theme. Change the variables in src/app/globals.css and this page follows.
export function DesignCatalog() {
  return (
    <Page width="wide">
      <PageHeader
        title="Design system"
        description="The shadcn components this app uses, in the current theme (src/app/globals.css)."
      />

      <div className="space-y-12">
        <Section title="Colors">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {COLORS.map(([className, label]) => (
              <li key={className} className="flex items-center gap-3">
                <span className={`size-10 shrink-0 rounded-md border ${className}`} />
                <span className="text-sm">
                  {label}
                  <code className="block font-mono text-xs text-muted-foreground">{className}</code>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
            <Link href="/design" className={buttonVariants({ variant: 'outline' })}>
              Link styled as a button
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon-sm" variant="outline" className="rounded-full">
              3
            </Button>
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap gap-2">
            <Badge>Completed</Badge>
            <Badge variant="secondary">In progress</Badge>
            <Badge variant="outline">Not started</Badge>
            <Badge variant="destructive">0:42</Badge>
            <Badge className="bg-success text-success-foreground">Correct answer</Badge>
          </div>
        </Section>

        <Section title="Card">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Sample Quiz</CardTitle>
              <CardDescription>A card title, description and footer.</CardDescription>
            </CardHeader>
            <CardFooter className="justify-between">
              <span className="text-muted-foreground">5 min</span>
              <Button>Start quiz</Button>
            </CardFooter>
          </Card>
        </Section>

        <Section title="Forms">
          <form className="max-w-sm">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="design-email">Email</FieldLabel>
                <Input id="design-email" type="email" defaultValue="reader@example.com" />
              </Field>
              <Field>
                <FieldLabel htmlFor="design-password">Password</FieldLabel>
                <Input id="design-password" type="password" defaultValue="password" />
                <FieldDescription>At least 8 characters</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="design-json">Textarea</FieldLabel>
                <Textarea id="design-json" className="font-mono" defaultValue={'{ "title": "New Quiz" }'} />
              </Field>
            </FieldGroup>
          </form>
        </Section>

        <Section title="Choices and progress">
          <div className="grid max-w-md gap-6">
            <RadioGroup defaultValue="paris" aria-label="Single choice">
              {['Paris', 'London'].map((city) => (
                <label key={city} className="flex items-center gap-3">
                  <RadioGroupItem value={city.toLowerCase()} />
                  {city}
                </label>
              ))}
            </RadioGroup>
            <div className="grid gap-2">
              {['Red', 'Green'].map((color, index) => (
                <label key={color} className="flex items-center gap-3">
                  <Checkbox defaultChecked={index === 0} />
                  {color}
                </label>
              ))}
            </div>
            <Progress value={40} aria-label="Answered" />
          </div>
        </Section>

        <Section title="Alerts">
          <div className="grid max-w-md gap-3">
            <Alert role="status">
              <CircleCheck />
              <AlertDescription>Account created. Log in to start.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Fix these before saving:</AlertTitle>
              <AlertDescription>Invalid JSON syntax.</AlertDescription>
            </Alert>
          </div>
        </Section>

        <Section title="Table">
          <Card className="max-w-md py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Rank</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="pr-4 text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted font-medium">
                    <TableCell className="pl-4">1</TableCell>
                    <TableCell>You</TableCell>
                    <TableCell className="pr-4 text-right">50 / 70</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-4">2</TableCell>
                    <TableCell>Test User</TableCell>
                    <TableCell className="pr-4 text-right">40 / 70</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Section>

        <Section title="Empty state">
          <EmptyState>No quizzes yet. Check back soon.</EmptyState>
        </Section>
      </div>
    </Page>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <Separator className="mt-2 mb-4" />
      {children}
    </section>
  )
}
