import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import {
  ContentWrapper,
  Footer,
  RootWrapper,
} from '~/services/mail/templates/components';

interface WelcomeTemplateProps {
  email: string;
  link: string;
}

export const Welcome = ({ email, link }: WelcomeTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Welcome to FanJam!</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Welcome to FanJam!
          </Heading>
          <Section className="py-6 mx-auto font-bold text-center text-gray-900 text-base">
            {email}
          </Section>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            FanJam is an event planning app for conventions.
          </Text>
          <Text className="text-gray-600 text-center text-sm !mt-0">
            For small to medium-size cons, FanJam bridges the gap between a
            single person with a spreadsheet and the kinds of people who can
            afford enterprise event planning software. Free for small cons.
          </Text>
          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Go to your schedule</Text>
          </Button>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

Welcome.PreviewProps = {
  email: 'janedoe@nocodb.com',
  link: 'https://nocodb.com',
};

export default Welcome;
