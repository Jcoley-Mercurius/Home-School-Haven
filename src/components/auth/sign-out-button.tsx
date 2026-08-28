import { signOut } from "@/app/(auth)/sign-in/actions"
import { Button } from "@/components/ui/button"

/**
 * Sign out. A form POST rather than a link, so it cannot be triggered by a
 * prefetch, a crawler, or an image tag on another site.
 */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="secondary" size="sm">
        Sign Out
      </Button>
    </form>
  )
}
