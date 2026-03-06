import { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ - Frequently Asked Questions | VibraCode AI Mobile App Builder",
  description: "Get answers to common questions about VibraCode, the AI-powered mobile app builder. Learn how to create iOS and Android apps instantly without coding.",
  keywords: [
    "VibraCode FAQ",
    "mobile app builder questions",
    "AI app builder help",
    "iOS app creation",
    "Android app development",
    "no code app builder",
    "mobile app development platform"
  ],
  openGraph: {
    title: "FAQ - Frequently Asked Questions | VibraCode AI Mobile App Builder",
    description: "Get answers to common questions about VibraCode, the AI-powered mobile app builder. Learn how to create iOS and Android apps instantly without coding.",
    url: "https://vibracodeapp.com/faq",
  },
};

export default function FAQPage() {
  const faqs = [
    {
      question: "What is VibraCode?",
      answer: "VibraCode is an AI-powered mobile app builder that allows you to create iOS and Android apps instantly without any coding knowledge. Simply describe your app idea, and our AI will generate a fully functional mobile application for you."
    },
    {
      question: "Do I need coding experience to use VibraCode?",
      answer: "No coding experience required! VibraCode is designed for everyone - from complete beginners to experienced developers. Our AI handles all the technical aspects of app development, so you can focus on your app idea and user experience."
    },
    {
      question: "What types of mobile apps can I create?",
      answer: "You can create a wide variety of mobile apps including calculators, note-taking apps, timers, flashlights, color pickers, unit converters, todo lists, and many more. Our AI specializes in creating simple, functional mobile applications that work perfectly on both iOS and Android devices."
    },
    {
      question: "How long does it take to create an app?",
      answer: "Most apps are generated in just a few minutes! The AI processes your description and creates a fully functional mobile app almost instantly. You can then customize and deploy your app right away."
    },
    {
      question: "Can I create apps for both iOS and Android?",
      answer: "Yes! VibraCode creates cross-platform mobile apps that work seamlessly on both iOS and Android devices. You don't need to create separate versions - one app works everywhere."
    },
    {
      question: "Is there a free plan available?",
      answer: "Yes, we offer a free plan that allows you to create and test mobile apps. For advanced features and unlimited app creation, we have premium plans available."
    },
    {
      question: "How do I get started with VibraCode?",
      answer: "Getting started is easy! Simply sign up for a free account, describe your mobile app idea in plain English, and let our AI create your app. You can start building your first mobile app in under 5 minutes."
    },
    {
      question: "Can I customize my generated app?",
      answer: "Absolutely! After the AI generates your initial app, you can customize colors, layouts, features, and functionality. Our platform gives you full control over your app's appearance and behavior."
    },
    {
      question: "What programming languages does VibraCode use?",
      answer: "VibraCode uses modern mobile development technologies including React Native, Expo, and other cross-platform frameworks to ensure your apps work perfectly on all devices without you needing to know any programming languages."
    },
    {
      question: "Is my app idea safe and secure?",
      answer: "Yes, we take security seriously. Your app ideas and generated code are protected with enterprise-grade security measures. We never share your ideas or code with third parties without your explicit permission."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Get answers to common questions about VibraCode, the AI-powered mobile app builder that creates iOS and Android apps instantly.
            </p>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300">
                <h3 className="text-xl font-semibold text-white mb-4">
                  {faq.question}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-4">
                Still have questions?
              </h2>
              <p className="text-gray-300 mb-6">
                Can't find the answer you're looking for? Our support team is here to help!
              </p>
              <a 
                href="/contact" 
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-full hover:from-purple-700 hover:to-blue-700 transition-all duration-300"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
