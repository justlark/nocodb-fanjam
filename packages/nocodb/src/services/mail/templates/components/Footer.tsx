import { Container, Text } from '@react-email/components';
import * as React from 'react';

export const Footer = () => {
  return (
    <Container className="px-3">
      <Text className="text-gray-500 m-auto text-sm max-w-[400px] text-center">
        FanJam is an event planning app for conventions.
      </Text>
    </Container>
  );
};
