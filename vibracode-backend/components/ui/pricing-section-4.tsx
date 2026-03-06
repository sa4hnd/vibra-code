"use client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sparkles as SparklesComp } from "@/components/ui/sparkles";
import { TimelineContent } from "@/components/ui/timeline-animation";
import {VerticalCutReveal} from "@/components/ui/vertical-cut-reveal";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { getPaidPlans } from "@/lib/plans";
import { createStripeCheckoutSessionAction } from "@/app/actions/stripe/create-checkout-session";
import { createStripeCustomerPortalSessionAction } from "@/app/actions/stripe/create-customer-portal-session";
import { CustomLoader } from "./custom-loader";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Settings, CreditCard } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const PricingSwitch = ({ onSwitch }: { onSwitch: (value: string) => void }) => {
  const [selected, setSelected] = useState("0");

  const handleSwitch = (value: string) => {
    setSelected(value);
    onSwitch(value);
  };

  return (
    <div className="flex justify-center">
      <div className="relative z-10 mx-auto flex w-fit rounded-full bg-neutral-900 border border-gray-700 p-1">
        <button
          onClick={() => handleSwitch("0")}
          className={cn(
            "relative z-10 w-fit h-10  rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
            selected === "0" ? "text-white" : "text-gray-200",
          )}
        >
          {selected === "0" && (
            <motion.span
              layoutId={"switch"}
              className="absolute top-0 left-0 h-10 w-full rounded-full border-4 shadow-sm shadow-blue-600 border-blue-600 bg-gradient-to-t from-blue-500 to-blue-600"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative">Monthly</span>
        </button>

        <button
          onClick={() => handleSwitch("1")}
          className={cn(
            "relative z-10 w-fit h-10 flex-shrink-0 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
            selected === "1" ? "text-white" : "text-gray-200",
          )}
        >
          {selected === "1" && (
            <motion.span
              layoutId={"switch"}
              className="absolute top-0 left-0 h-10 w-full  rounded-full border-4 shadow-sm shadow-blue-600 border-blue-600 bg-gradient-to-t from-blue-500 to-blue-600"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-2">Yearly</span>
        </button>
      </div>
    </div>
  );
};

export default function PricingSection6() {
  const [isYearly, setIsYearly] = useState(false);
  const pricingRef = useRef<HTMLDivElement>(null);
  const paidPlans = getPaidPlans() || [];
  const { user } = useUser();
  
  // Get user's subscription information
  const userData = useQuery(api.usage.getUserByClerkId, 
    user?.id ? { clerkId: user.id } : "skip"
  );
  
  // Check if user has an active subscription (not free plan)
  const hasActiveSubscription = userData?.subscriptionPlan && userData.subscriptionPlan !== 'free';
  
  // Debug logging
  console.log('Paid plans:', paidPlans);
  console.log('User subscription:', userData?.subscriptionPlan);

  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        delay: i * 0.4,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      y: -20,
      opacity: 0,
    },
  };

  const togglePricingPeriod = (value: string) =>
    setIsYearly(Number.parseInt(value) === 1);

  const handlePlanSelect = async (planId: string) => {
    const formData = new FormData();
    formData.append('planId', planId);
    await createStripeCheckoutSessionAction(formData);
  };

  // Don't render if no plans are available
  if (!paidPlans || paidPlans.length === 0) {
    return (
      <div className="min-h-screen w-full mx-auto relative bg-black flex items-center justify-center">
        <CustomLoader text="Loading" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full mx-auto relative bg-black overflow-x-hidden pt-20"
      ref={pricingRef}
    >
      <TimelineContent
        animationNum={4}
        timelineRef={pricingRef}
        customVariants={revealVariants}
        className="absolute top-0 h-96 w-screen overflow-hidden [mask-image:radial-gradient(50%_50%,white,transparent)] z-10"
      >
        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#ffffff2c_1px,transparent_1px),linear-gradient(to_bottom,#3a3a3a01_1px,transparent_1px)] bg-[size:70px_80px] "></div>
        <SparklesComp
          density={1800}
          speed={1}
          color="#FFFFFF"
          className="absolute inset-x-0 bottom-0 h-full w-full [mask-image:radial-gradient(50%_50%,white,transparent_85%)]"
        />
      </TimelineContent>
      <TimelineContent
        animationNum={5}
        timelineRef={pricingRef}
        customVariants={revealVariants}
        className="absolute left-0 top-[-114px] w-full h-[113.625vh] flex flex-col items-start justify-start content-start flex-none flex-nowrap gap-2.5 overflow-hidden p-0 z-0"
      >
        <div className="framer-1i5axl2">
          <div
            className="absolute left-[-568px] right-[-568px] top-0 h-[2053px] flex-none rounded-full"
            style={{
              border: "200px solid #3131f5",
              filter: "blur(92px)",
              WebkitFilter: "blur(92px)",
            }}
            data-border="true"
            data-framer-name="Ellipse 1"
          ></div>
          <div
            className="absolute left-[-568px] right-[-568px] top-0 h-[2053px] flex-none rounded-full"
            style={{
              border: "200px solid #3131f5",
              filter: "blur(92px)",
              WebkitFilter: "blur(92px)",
            }}
            data-border="true"
            data-framer-name="Ellipse 2"
          ></div>
        </div>
      </TimelineContent>

      <article className="text-center mb-6 pt-12 max-w-3xl mx-auto space-y-2 relative z-50">
        <h2 className="text-4xl font-medium text-white">
          <VerticalCutReveal
            splitBy="words"
            staggerDuration={0.15}
            staggerFrom="first"
            reverse={true}
            containerClassName="justify-center "
            transition={{
              type: "spring",
              stiffness: 250,
              damping: 40,
              delay: 0, // First element
            }}
          >
            Choose Your Plan
          </VerticalCutReveal>
        </h2>

        <TimelineContent
          as="p"
          animationNum={0}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="text-gray-300"
        >
          Select the perfect plan for your development needs. All plans include unlimited sessions - only credits limit your usage.
        </TimelineContent>

        <TimelineContent
          as="div"
          animationNum={1}
          timelineRef={pricingRef}
          customVariants={revealVariants}
        >
          <PricingSwitch onSwitch={togglePricingPeriod} />
        </TimelineContent>

        {/* Manage Billing Button - only show for users with active subscriptions */}
        {user && hasActiveSubscription && (
          <TimelineContent
            as="div"
            animationNum={2}
            timelineRef={pricingRef}
            customVariants={revealVariants}
            className="mt-6"
          >
            <form action={createStripeCustomerPortalSessionAction}>
              <Button
                type="submit"
                variant="outline"
                className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-200"
              >
                <Settings className="w-4 h-4 mr-2" />
                Manage Billing
              </Button>
            </form>
          </TimelineContent>
        )}
      </article>

      <div
        className="absolute top-0 left-[10%] right-[10%] w-[80%] h-full z-0"
        style={{
          backgroundImage: `
        radial-gradient(circle at center, #206ce8 0%, transparent 70%)
      `,
          opacity: 0.6,
          mixBlendMode: "multiply",
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 max-w-7xl gap-3 py-6 mx-auto px-4">
        {paidPlans && paidPlans.length > 0 && paidPlans.map((plan, index) => (
          <TimelineContent
            key={plan.id}
            as="div"
            animationNum={2 + index}
            timelineRef={pricingRef}
            customVariants={revealVariants}
          >
            <Card
              className={`relative text-white border-neutral-800 ${
                plan.id === 'pro'
                  ? "bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 shadow-[0px_-13px_300px_0px_#0900ff] z-20"
                  : "bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 z-10"
              }`}
            >
              <CardHeader className="text-left p-4">
                <div className="flex justify-between">
                  <h3 className="text-2xl mb-1">{plan.displayName}</h3>
                </div>
                <div className="flex items-baseline">
                  <span className="text-3xl font-semibold ">
                    $
                    <NumberFlow
                      format={{
                        currency: "USD",
                      }}
                      value={isYearly ? Math.round(plan.price * 10) : plan.price}
                      className="text-3xl font-semibold"
                    />
                  </span>
                  <span className="text-gray-300 ml-1 text-sm">
                    /{isYearly ? "year" : plan.id === 'weekly_plus' ? "week" : "month"}
                  </span>
                </div>
                <p className="text-xs text-gray-300 mb-3">{plan.description}</p>
              </CardHeader>

              <CardContent className="pt-0 p-4">
                <button
                  onClick={() => handlePlanSelect(plan.id)}
                  className={`w-full mb-4 p-3 text-lg rounded-xl transition-all duration-200 ${
                    plan.id === 'pro'
                      ? "bg-gradient-to-t from-blue-500 to-blue-600 shadow-lg shadow-blue-800 border border-blue-500 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow-xl hover:shadow-blue-900"
                      : "bg-gradient-to-t from-neutral-950 to-neutral-600 shadow-lg shadow-neutral-900 border border-neutral-800 text-white hover:from-neutral-800 hover:to-neutral-500 hover:shadow-xl hover:shadow-neutral-800"
                  }`}
                >
                  {plan.id === 'weekly_plus' ? 'Start Weekly Trial' : 
                   plan.id === 'pro' ? 'Get Started' :
                   plan.id === 'business' ? 'Upgrade to Business' :
                   'Get Started'}
                </button>

                <div className="space-y-2 pt-3 border-t border-neutral-700">
                  <h4 className="font-medium text-sm mb-2">
                    What's included:
                  </h4>
                  <ul className="space-y-1">
                    {plan.features.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className="flex items-center gap-2"
                      >
                        <span className="h-2 w-2 bg-neutral-500 rounded-full grid place-content-center"></span>
                        <span className="text-xs text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TimelineContent>
        ))}
      </div>
    </div>
  );
}
