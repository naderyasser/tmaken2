'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Trash2, Pencil, MoreVertical, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'

interface ShiftType {
    name: string
    shift_type?: string // Assuming a custom field or similar, otherwise fallback
}

export function ShiftManagementList() {
    const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const { toast } = useToast()

    const loadShiftTypes = useCallback(async () => {
        try {
            setLoading(true)
            const response = await frappeClient.get<ShiftType[]>('Shift Type', undefined, {
                fields: ['name'],
                order_by: 'name asc',
                limit_page_length: 50,
            })
            setShiftTypes(response.data || [])
        } catch (error) {
            console.error('Failed to load shift types:', error)
            toast({ title: 'خطأ', description: 'فشل في تحميل أوقات العمل', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }, [toast])

    useEffect(() => {
        loadShiftTypes()
    }, [loadShiftTypes])

    const filteredShifts = shiftTypes.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div dir="rtl" className="space-y-4 p-6 font-[family-name:var(--font-arabic)] bg-[#f3f4f6] min-h-screen">
            

            {/* Main Card: Toolbar + Table */}
            <div className="bg-white rounded-md shadow-sm border border-slate-200/60 overflow-hidden">
                
                {/* Top Toolbar */}
                <div className="flex items-center gap-3 p-4 bg-white">
                    {/* Search Bar (Right in RTL) */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#195a9e]" />
                        <Input 
                            placeholder="إبحث بإسم الدوام" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-3 h-9 rounded-sm border-slate-300 focus-visible:ring-blue-500 w-full text-right placeholder:text-slate-400"
                        />
                    </div>

                    {/* Actions Dropdown */}
                    <Select disabled>
                        <SelectTrigger className="w-32 bg-white text-slate-500 h-9 rounded-sm border-slate-300 text-[13px] font-bold">
                            <SelectValue placeholder="الاجراءات" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="delete">حذف</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Add Button (Left in RTL) */}
                    <Button className="bg-[#2eb872] hover:bg-[#289e63] text-white px-5 rounded-sm font-bold text-[13px] h-9 shrink-0">
                        إضافة دوام
                        <Plus className="h-4 w-4 mr-2" strokeWidth={3} />
                    </Button>
                </div>

                {/* Table Area */}
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px] text-right">
                        <thead>
                            <tr className="bg-[#cbd5e1] text-slate-700 border-y border-slate-300 h-10">
                                <th className="px-4 font-bold w-12 text-center">
                                    <Checkbox className="rounded-sm border-slate-500" />
                                </th>
                                <th className="px-4 font-bold">إسم الدوام</th>
                                <th className="px-4 font-bold text-center">نوع الدوام</th>
                                <th className="px-4 font-bold w-40 text-center">الاجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-[#195a9e] mx-auto" />
                                    </td>
                                </tr>
                            ) : filteredShifts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center text-slate-500">
                                        لا توجد بيانات
                                    </td>
                                </tr>
                            ) : (
                                filteredShifts.map((shift, idx) => (
                                    <tr key={shift.name} className="border-b border-slate-100 hover:bg-slate-50 h-12">
                                        <td className="px-4 text-center">
                                            <Checkbox className="rounded-sm border-slate-400" />
                                        </td>
                                        <td className="px-4">
                                            <a href="#" className="text-[#195a9e] hover:underline font-bold">
                                                {shift.name}
                                            </a>
                                        </td>
                                        <td className="px-4 text-slate-700 font-bold text-center">
                                            {shift.shift_type || 'دوام عادي'}
                                        </td>
                                        <td className="px-4">
                                            <div className="flex items-center justify-center">
                                                {/* Dots, Trash, Pencil in RTL order (Right to Left) */}
                                                <button className="text-[#195a9e] hover:text-blue-800 transition-colors px-2">
                                                    <MoreVertical className="h-[18px] w-[18px]" strokeWidth={2.5} />
                                                </button>
                                                <div className="w-px h-5 bg-slate-300 mx-1" />
                                                <button className="text-red-500 hover:text-red-600 transition-colors px-2">
                                                    <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
                                                </button>
                                                <div className="w-px h-5 bg-slate-300 mx-1" />
                                                <button className="text-green-500 hover:text-green-600 transition-colors px-2">
                                                    <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-100 text-sm bg-white">
                    {/* Go to page (Right side of screen, so first in DOM) */}
                    <div className="flex items-center gap-2 mt-4 sm:mt-0 font-bold">
                        <span className="text-slate-700 text-[13px] ml-2">اذهب إلى صفحة</span>
                        <Input className="w-16 h-8 rounded-sm border-slate-300 text-center" />
                        <Button variant="link" className="text-[#195a9e] h-8 px-2 font-bold">
                            اذهب
                        </Button>
                    </div>

                    {/* Pagination arrows & Rows per page (Left side of screen) */}
                    <div className="flex items-center gap-6 text-slate-700 font-bold text-[13px]">
                        
                        {/* Pagination Arrows */}
                        <div className="flex items-center gap-1 border border-slate-200 rounded-sm overflow-hidden bg-white">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-l border-slate-200" disabled>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-l border-slate-200" disabled>
                                <ChevronRight className="h-4 w-4 opacity-50" />
                            </Button>
                            <Button variant="default" className="h-8 w-8 rounded-none bg-[#195a9e] text-white hover:bg-[#1b5b9f]">
                                1
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-r border-slate-200" disabled>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" disabled>
                                <ChevronLeft className="h-4 w-4 opacity-50" />
                            </Button>
                        </div>

                        {/* Rows per page */}
                        <div className="flex items-center gap-2">
                            <span>عدد الصفوف</span>
                            <Select defaultValue="5">
                                <SelectTrigger className="w-16 h-8 rounded-sm border-slate-300 bg-white shadow-sm font-bold text-[13px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">5</SelectItem>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

