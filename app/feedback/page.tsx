import FeedbackForm from '@/app/feedback-form';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Feedback · Rally'};
export default function FeedbackPage(){return <FeedbackForm/>;}
