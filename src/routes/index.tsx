import { createFileRoute } from '@tanstack/react-router';
import SopGenerator from '../pages/SopGenerator/SopGenerator';

export const Route = createFileRoute('/')({ component: SopGenerator });
