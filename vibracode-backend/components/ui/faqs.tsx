'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import Link from 'next/link'

export default function FAQs() {
    const faqItems = [
        {
            id: 'item-1',
            question: 'How does the AI development platform work?',
            answer: 'Our AI platform uses advanced language models to understand your requirements and generate complete applications, websites, and prototypes. Simply describe what you want to build, and our AI will create the code, design, and functionality for you.',
        },
        {
            id: 'item-2',
            question: 'What types of projects can I build?',
            answer: 'You can build web applications, mobile apps, websites, dashboards, e-commerce stores, APIs, and more. Our AI supports React, Next.js, mobile development, and various other technologies and frameworks.',
        },
        {
            id: 'item-3',
            question: 'How accurate is the generated code?',
            answer: 'Our AI generates production-ready code with modern best practices. The code includes proper error handling, responsive design, and follows industry standards. You can always review and modify the generated code to fit your specific needs.',
        },
        {
            id: 'item-4',
            question: 'Can I customize the generated applications?',
            answer: 'Absolutely! All generated code is fully customizable. You can modify the design, add features, change functionality, or integrate with your existing systems. The AI provides a solid foundation that you can build upon.',
        },
        {
            id: 'item-5',
            question: 'What payment methods do you accept?',
            answer: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, and Google Pay. For enterprise customers, we also offer invoicing options and custom billing arrangements.',
        },
        {
            id: 'item-6',
            question: 'Is there a free trial available?',
            answer: 'Yes! We offer a free trial that allows you to test our platform and build your first project. You can upgrade to a paid plan anytime to unlock more features, higher usage limits, and priority support.',
        },
    ]

    return (
        <section className="py-16 md:py-24 bg-black">
            <div className="mx-auto max-w-2xl px-6">
                <div className="space-y-12">
                    <h2 className="text-white text-center text-4xl font-semibold">Frequently Asked Questions</h2>

                    <Accordion
                        type="single"
                        collapsible
                        className="-mx-2 sm:mx-0">
                        {faqItems.map((item) => (
                            <div
                                className="group"
                                key={item.id}>
                                <AccordionItem
                                    value={item.id}
                                    className="data-[state=open]:bg-white/5 peer rounded-xl border-none px-5 py-1 data-[state=open]:border-none md:px-7 bg-white/5 border border-white/10">
                                    <AccordionTrigger className="cursor-pointer text-base hover:no-underline text-white">{item.question}</AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-base text-gray-300">{item.answer}</p>
                                    </AccordionContent>
                                </AccordionItem>
                                <hr className="mx-5 -mb-px group-last:hidden peer-data-[state=open]:opacity-0 md:mx-7 border-white/10" />
                            </div>
                        ))}
                    </Accordion>

                    <p className="text-gray-400 text-center">
                        Can't find what you're looking for? Contact our{' '}
                        <Link
                            href="#"
                            className="text-white font-medium hover:underline">
                            customer support team
                        </Link>
                    </p>
                </div>
            </div>
        </section>
    )
}
