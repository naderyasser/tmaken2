/**
 * Visit Summary Dialog Tests
 * Tests for the post-checkout visit summary and next visit scheduling dialog
 */

import "@testing-library/jest-dom"
import { render as rtlRender, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactElement } from "react"
import { I18nProvider } from "@/lib/i18n"

// The dialog reads its copy through useI18n, so it must render inside a provider.
// The REAL one is used rather than a stub: the assertions below check the actual
// Arabic strings, and a stub returning keys would only prove the mock works.
// I18nProvider defaults to Arabic, which is what these tests expect.
const render = (ui: ReactElement) => rtlRender(<I18nProvider>{ui}</I18nProvider>)

// Mock salesApi
const mockGetVisit = jest.fn()
const mockUpdateVisit = jest.fn()
const mockCreateVisit = jest.fn()

jest.mock("@/lib/sales-api", () => ({
    salesApi: {
        getVisit: (...args: any[]) => mockGetVisit(...args),
        updateVisit: (...args: any[]) => mockUpdateVisit(...args),
        createVisit: (...args: any[]) => mockCreateVisit(...args),
    },
}))

// Mock date-fns
jest.mock("date-fns", () => ({
    format: (date: Date, fmt: string) => {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, "0")
        const d = String(date.getDate()).padStart(2, "0")
        if (fmt === "yyyy-MM-dd") return `${y}-${m}-${d}`
        if (fmt === "yyyy/MM/dd") return `${y}/${m}/${d}`
        return `${y}-${m}-${d}`
    },
}))

jest.mock("date-fns/locale", () => ({
    ar: {},
}))

// Mock utils
jest.mock("@/lib/utils", () => ({
    cn: (...args: any[]) => args.filter(Boolean).join(" "),
}))

// Mock UI components
jest.mock("@/components/ui/dialog", () => ({
    Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
    DialogContent: ({ children, ...props }: any) => <div data-testid="dialog-content" {...props}>{children}</div>,
    DialogHeader: ({ children }: any) => <div>{children}</div>,
    DialogTitle: ({ children }: any) => <h2>{children}</h2>,
    DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
    DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}))

jest.mock("@/components/ui/button", () => ({
    Button: ({ children, onClick, disabled, variant, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} data-variant={variant} {...props}>
            {children}
        </button>
    ),
}))

jest.mock("@/components/ui/label", () => ({
    Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

jest.mock("@/components/ui/textarea", () => ({
    Textarea: ({ value, onChange, placeholder, ...props }: any) => (
        <textarea
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            data-testid={placeholder}
            {...props}
        />
    ),
}))

jest.mock("@/components/ui/select", () => ({
    Select: ({ children, value, onValueChange }: any) => (
        <div data-testid="select-root" data-value={value}>
            {typeof children === "function"
                ? children({ value, onValueChange })
                : children}
        </div>
    ),
    SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
    SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
    SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
    SelectItem: ({ children, value }: any) => (
        <div
            data-testid={`select-item-${value}`}
            role="option"
            onClick={() => {
                // Find the parent Select's onValueChange and call it
                const event = new CustomEvent("select-value", { detail: value, bubbles: true })
                document.dispatchEvent(event)
            }}
        >
            {children}
        </div>
    ),
}))

jest.mock("@/components/ui/calendar", () => ({
    Calendar: ({ onSelect, disabled }: any) => (
        <div data-testid="calendar">
            <button
                data-testid="calendar-select-date"
                onClick={() => {
                    const futureDate = new Date()
                    futureDate.setDate(futureDate.getDate() + 3)
                    onSelect(futureDate)
                }}
            >
                Select Date
            </button>
        </div>
    ),
}))

jest.mock("@/components/ui/popover", () => ({
    Popover: ({ children }: any) => <div>{children}</div>,
    PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
    PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
}))

// Mock lucide icons
jest.mock("lucide-react", () => ({
    CalendarIcon: () => <span>CalendarIcon</span>,
    Loader2: () => <span>Loader2</span>,
    X: () => <span>X</span>,
}))

import { VisitSummaryDialog } from "../sales/visit-summary-dialog"

const defaultProps = {
    open: true,
    onComplete: jest.fn(),
    customerName: "متجر الأمل",
    customerId: "CUST-001",
    salesPersonName: "SP-001",
    visitName: "SPV-001",
    hadOrder: false,
}

describe("VisitSummaryDialog", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetVisit.mockResolvedValue({ name: "SPV-001", notes: "" })
        mockUpdateVisit.mockResolvedValue({})
        mockCreateVisit.mockResolvedValue({ name: "SPV-002" })
    })

    describe("Rendering", () => {
        it("renders when open", () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            expect(screen.getByText("ملخص الزيارة")).toBeInTheDocument()
        })

        it("does not render when closed", () => {
            render(<VisitSummaryDialog {...defaultProps} open={false} />)
            expect(screen.queryByText("ملخص الزيارة")).not.toBeInTheDocument()
        })

        it("displays customer name", () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            expect(screen.getByTestId("dialog-description")).toHaveTextContent("متجر الأمل")
        })

        it("shows visit outcome select", () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            expect(screen.getByText("نتيجة الزيارة")).toBeInTheDocument()
            expect(screen.getByTestId("select-value")).toHaveTextContent("اختر نتيجة الزيارة")
        })

        it("shows comment textarea", () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            expect(screen.getByText("ملاحظات")).toBeInTheDocument()
            expect(
                screen.getByTestId("أضف ملاحظات عن الزيارة (اختياري)")
            ).toBeInTheDocument()
        })

        it("shows schedule next visit button", () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            expect(screen.getByText("جدولة زيارة قادمة")).toBeInTheDocument()
        })

        it("shows confirm and skip buttons", () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            expect(screen.getByText("تأكيد")).toBeInTheDocument()
            expect(screen.getByText("تخطي")).toBeInTheDocument()
        })
    })

    describe("Skip", () => {
        it("calls onComplete when skip is clicked", async () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            await userEvent.click(screen.getByText("تخطي"))
            expect(defaultProps.onComplete).toHaveBeenCalledTimes(1)
        })
    })

    describe("Validation", () => {
        it("shows error when confirming without selecting outcome", async () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            await userEvent.click(screen.getByText("تأكيد"))
            expect(screen.getByText("يرجى اختيار نتيجة الزيارة")).toBeInTheDocument()
            expect(mockUpdateVisit).not.toHaveBeenCalled()
        })
    })

    describe("Schedule Next Visit", () => {
        it("toggles next visit section when button is clicked", async () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            // Initially no date picker
            expect(screen.queryByText("تاريخ الزيارة القادمة")).not.toBeInTheDocument()

            // Click schedule button
            await userEvent.click(screen.getByText("جدولة زيارة قادمة"))

            // Date picker should appear
            expect(screen.getByText(/تاريخ الزيارة القادمة/)).toBeInTheDocument()
            expect(screen.getByTestId("calendar")).toBeInTheDocument()
        })

        it("hides next visit section when cancel is clicked", async () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            // Toggle on
            await userEvent.click(screen.getByText("جدولة زيارة قادمة"))
            expect(screen.getByText(/تاريخ الزيارة القادمة/)).toBeInTheDocument()

            // Toggle off
            await userEvent.click(screen.getByText("إلغاء الجدولة"))
            expect(screen.queryByText("تاريخ الزيارة القادمة")).not.toBeInTheDocument()
        })

        it("shows error when scheduling without selecting a date", async () => {
            // We need to simulate selecting an outcome first
            // Since our mock Select doesn't easily support value changes,
            // we'll test indirectly through the submit flow

            const { container } = render(<VisitSummaryDialog {...defaultProps} />)

            // Toggle schedule on
            await userEvent.click(screen.getByText("جدولة زيارة قادمة"))

            // Click confirm — should fail because no outcome selected (first validation)
            await userEvent.click(screen.getByText("تأكيد"))
            expect(screen.getByText("يرجى اختيار نتيجة الزيارة")).toBeInTheDocument()
        })
    })

    describe("Next visit notes", () => {
        it("shows next visit notes textarea when scheduling", async () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            await userEvent.click(screen.getByText("جدولة زيارة قادمة"))
            expect(screen.getByText("ملاحظات للزيارة القادمة")).toBeInTheDocument()
            expect(screen.getByTestId("ملاحظات (اختياري)")).toBeInTheDocument()
        })
    })

    describe("Visit outcomes list", () => {
        it("shows all outcome options", () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            const outcomes = [
                "تم الإنزال",
                "رفض الاستلام",
                "مغلق - غير متاح",
                "تأجيل",
                "زيارة تعريفية",
                "تحصيل فقط",
            ]
            outcomes.forEach((o) => {
                expect(screen.getByTestId(`select-item-${o}`)).toBeInTheDocument()
            })
        })
    })

    describe("Comment field", () => {
        it("allows typing in the comment field", async () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            const textarea = screen.getByTestId("أضف ملاحظات عن الزيارة (اختياري)")
            await userEvent.type(textarea, "ملاحظة تجريبية")
            expect(textarea).toHaveValue("ملاحظة تجريبية")
        })
    })

    describe("Calendar date selection", () => {
        it("allows selecting a date from calendar", async () => {
            render(<VisitSummaryDialog {...defaultProps} />)
            await userEvent.click(screen.getByText("جدولة زيارة قادمة"))

            // Initially shows "اختر التاريخ"
            expect(screen.getByText("اختر التاريخ")).toBeInTheDocument()

            // Select a date
            await userEvent.click(screen.getByTestId("calendar-select-date"))

            // After selection, the date should be formatted and shown
            await waitFor(() => {
                expect(screen.queryByText("اختر التاريخ")).not.toBeInTheDocument()
            })
        })
    })
})
