import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Button } from "@/components/ui/button"

describe("Button", () => {
  it("renders with default variant", () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole("button", { name: /click me/i })
    expect(button).toBeInTheDocument()
  })

  it("handles click events", async () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    const button = screen.getByRole("button", { name: /click me/i })
    await userEvent.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("can be disabled", () => {
    render(<Button disabled>Click me</Button>)
    const button = screen.getByRole("button", { name: /click me/i })
    expect(button).toBeDisabled()
  })
})
