import { NativeModules } from 'react-native';

import MockKernel from '../kernel/MockKernel';

const NativeKernel = NativeModules.ExponentKernel || MockKernel;

export async function showOrangeMenuAsync(): Promise<boolean> {
  return await NativeKernel.showOrangeMenuAsync();
}

export async function hideOrangeMenuAsync(): Promise<boolean> {
  return await NativeKernel.hideOrangeMenuAsync();
}

export async function toggleOrangeMenuAsync(): Promise<boolean> {
  return await NativeKernel.toggleOrangeMenuAsync();
}

export async function isOrangeMenuVisibleAsync(): Promise<boolean> {
  return await NativeKernel.isOrangeMenuVisibleAsync();
}
