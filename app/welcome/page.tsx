import type {Metadata} from 'next';
import OnboardingFlow from '../onboarding-flow';
export const metadata:Metadata={title:'Welcome · Rally',robots:{index:false}};
export default function WelcomePage(){return <OnboardingFlow/>;}
