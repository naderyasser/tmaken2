import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">المهمة غير موجودة</h1>
      <p>لم يتم العثور على المهمة المطلوبة</p>
      <Button asChild className="mt-4">
        <Link href="/">
          <ArrowLeft className="ml-2 h-4 w-4" />
          العودة إلى الصفحة الرئيسية
        </Link>
      </Button>
    </div>
  )
}
